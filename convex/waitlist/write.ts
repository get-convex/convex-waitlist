import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, internalMutation, mutation } from "../_generated/server";
import {
  ACTIVE_SESSIONS_COUNT_LIMIT,
  getCounter,
  getSession,
  getWaitlistHead,
  newSessionPosition,
  newSessionStatus,
} from "./read";

// Defaults to 5 minutes.
const ACTIVE_SESSION_TIMEOUT_MS =
  +(process.env.ACTIVE_SESSION_TIMEOUT_SECONDS ?? 5 * 60) * 1000;

// Defaults to 1 minute.
const WAITING_SESSION_TIMEOUT_MS =
  +(process.env.WAITING_SESSION_TIMEOUT_SECONDS ?? 60) * 1000;

export const active = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const existingSession = await getSession(ctx, sessionId);

    if (existingSession !== null) {
      await bumpExpiration(ctx, existingSession);
    } else {
      const status = await newSessionStatus(ctx);
      const expireId = await scheduleExpiration(ctx, sessionId, status);
      const position = await newSessionPosition(ctx);
      await ctx.db.insert("waitlist", {
        status,
        position,
        sessionId,
        expireId,
      });
      if (status === "active") {
        await ctx.scheduler.runAfter(0, internal.waitlist.write.changeCounter, {
          status,
          change: 1,
        });
      }
    }
  },
});

export const expire = internalMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await getSession(ctx, sessionId);
    if (session === null) {
      return;
    }
    await ctx.db.delete(session._id);
    if (session.status === "active") {
      await ctx.scheduler.runAfter(0, internal.waitlist.write.changeCounter, {
        status: session.status,
        change: -1,
      });
    }
  },
});

async function bumpExpiration(
  ctx: MutationCtx,
  existingSession: Doc<"waitlist">
) {
  await ctx.scheduler.cancel(existingSession.expireId);
  const expireId = await scheduleExpiration(
    ctx,
    existingSession.sessionId,
    existingSession.status
  );
  await ctx.db.patch(existingSession._id, { expireId });
}

async function scheduleExpiration(
  ctx: MutationCtx,
  sessionId: string,
  status: "active" | "waiting"
) {
  return await ctx.scheduler.runAfter(
    status === "active"
      ? ACTIVE_SESSION_TIMEOUT_MS
      : WAITING_SESSION_TIMEOUT_MS,
    internal.waitlist.write.expire,
    { sessionId }
  );
}

export const changeCounter = internalMutation({
  args: {
    status: v.literal("active"),
    change: v.number(),
  },
  handler: async (ctx, { status: name, change }) => {
    const counter = await getCounter(ctx, name);
    const newValue = (counter?.count ?? 0) + change;
    const counterId = await upsertCounter(ctx, name, newValue);

    if (newValue < ACTIVE_SESSIONS_COUNT_LIMIT) {
      const head = await getWaitlistHead(ctx);
      if (head !== null) {
        await ctx.db.patch(head._id, { status: "active" });
        await bumpExpiration(ctx, head);
        await ctx.db.patch(counterId, { count: newValue + 1 });
      }
    }
  },
});

async function upsertCounter(
  ctx: MutationCtx,
  name: "active",
  count: number
): Promise<Id<"waitlistCounters">> {
  const counter = await getCounter(ctx, name);
  if (counter === null) {
    return await ctx.db.insert("waitlistCounters", { name, count });
  } else {
    await ctx.db.patch(counter._id, { count });
    return counter._id;
  }
}
