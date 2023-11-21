import { v } from "convex/values";
import { internal } from "../_generated/api";
import { MutationCtx, internalMutation, mutation } from "../_generated/server";
import {
  getCounter,
  getNumberOfWaiting,
  getWaitlistSession,
  newSessionPosition,
  newSessionStatus,
  validateSessionIsActive,
} from "./read";

// Defaults to 5 minutes.
const ACTIVE_SESSION_TIMEOUT_MS =
  +(process.env.ACTIVE_SESSION_TIMEOUT_SECONDS ?? 5 * 60) * 1000;

export const join = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const existingSession = await getWaitlistSession(ctx, sessionId);

    if (existingSession !== null) {
      // Already joined
      return;
    }

    const status = await newSessionStatus(ctx);
    const position = await newSessionPosition(ctx);
    await ctx.db.insert("waitlist", {
      status,
      position,
      sessionId,
      lastActive: Date.now(),
    });
    if (status === "active") {
      await ctx.scheduler.runAfter(0, internal.waitlist.write.changeCounter, {
        status,
        change: 1,
      });
    }
  },
});

export async function validateSessionAndRefreshLastActive(
  ctx: MutationCtx,
  sessionId: string
) {
  await validateSessionIsActive(ctx, sessionId);
  await refreshLastActive(ctx, sessionId);
}

export async function refreshLastActive(ctx: MutationCtx, sessionId: string) {
  const existingSession = await getWaitlistSession(ctx, sessionId);

  if (existingSession === null) {
    throw new Error("Unexpected `refreshLastActive` for invalid sessionId");
  }

  await ctx.db.patch(existingSession._id, { lastActive: Date.now() });
}

export const updateAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const numWaiting = await getNumberOfWaiting(ctx);

    if (numWaiting <= 0) {
      return;
    }

    const now = Date.now();
    const lastActiveCutoff = now - ACTIVE_SESSION_TIMEOUT_MS;
    const stale = await ctx.db
      .query("waitlist")
      .withIndex("byLastActive", (q) =>
        q.eq("status", "active").lt("lastActive", lastActiveCutoff)
      )
      // Handling the extreme edge case that too many people become inactive all at once
      .take(1000);
    await Promise.all(stale.map(({ _id }) => ctx.db.delete(_id)));
    const ready = await ctx.db
      .query("waitlist")
      .withIndex("byStatus", (q) => q.eq("status", "waiting"))
      .take(stale.length);
    await Promise.all(
      ready.map(({ _id }) =>
        ctx.db.patch(_id, { status: "active", lastActive: now })
      )
    );
    await ctx.scheduler.runAfter(0, internal.waitlist.write.changeCounter, {
      status: "active",
      change: ready.length - stale.length,
    });
  },
});

export const changeCounter = internalMutation({
  args: {
    status: v.literal("active"),
    change: v.number(),
  },
  handler: async (ctx, { status: name, change }) => {
    const counter = await getCounter(ctx, name);
    const count = Math.max(0, (counter?.count ?? 0) + change);
    if (counter === null) {
      await ctx.db.insert("waitlistCounters", { name, count });
    } else {
      await ctx.db.patch(counter._id, { count });
    }
  },
});
