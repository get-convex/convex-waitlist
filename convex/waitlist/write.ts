import { v } from "convex/values";
import { map } from "modern-async";
import { MutationCtx, internalMutation, mutation } from "../_generated/server";
import {
  getActiveSessionsCounter,
  getNumberOfWaiting,
  getWaitlistSession,
  newSessionPosition,
  newSessionStatus,
  validateSessionIsActive,
} from "./read";

// Defaults to 5 minutes.
const ACTIVE_SESSION_TIMEOUT_MS =
  +(process.env.ACTIVE_SESSION_TIMEOUT_SECONDS ?? 5 * 60) * 1000;

// Defaults to 1 minute.
const WAITING_SESSION_TIMEOUT_MS =
  +(process.env.WAITING_SESSION_TIMEOUT_SECONDS ?? 60) * 1000;

export const join = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const existingSession = await getWaitlistSession(ctx, sessionId);

    if (existingSession !== null) {
      if (existingSession.status === "waiting") {
        // waiting user came back, reset their lastActive
        await ctx.db.patch(existingSession._id, { lastActive: null });
      }
      return;
    }

    const status = await newSessionStatus(ctx);
    const position = await newSessionPosition(ctx);
    await ctx.db.insert("waitlist", {
      status,
      position,
      sessionId,
      lastActive: status === "active" ? Date.now() : null,
    });
    if (status === "active") {
      await changeActiveSessionsCounter(ctx, 1);
    }
  },
});

export const leave = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const existingSession = await getWaitlistSession(ctx, sessionId);

    if (existingSession === null) {
      // The sesion was deleted already
      return;
    }

    if (existingSession.status === "active") {
      // Ignore, active sessions expire based on user activity
    }

    await ctx.db.patch(existingSession._id, { lastActive: Date.now() });
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

export const updateWaitlist = internalMutation({
  args: {},
  handler: async (ctx) => {
    const numWaiting = await getNumberOfWaiting(ctx);

    if (numWaiting <= 0) {
      return;
    }

    await deleteStaleSessions(ctx, "waiting", WAITING_SESSION_TIMEOUT_MS);

    const staleActiveCount = await deleteStaleSessions(
      ctx,
      "active",
      ACTIVE_SESSION_TIMEOUT_MS
    );

    const ready = await ctx.db
      .query("waitlist")
      .withIndex("byStatus", (q) => q.eq("status", "waiting"))
      .take(staleActiveCount);
    const now = Date.now();
    await map(ready, ({ _id }) =>
      ctx.db.patch(_id, { status: "active", lastActive: now })
    );
    await changeActiveSessionsCounter(ctx, ready.length - staleActiveCount);
  },
});

async function deleteStaleSessions(
  ctx: MutationCtx,
  status: "active" | "waiting",
  timeoutMs: number
) {
  const now = Date.now();
  const lastActiveCutoff = now - timeoutMs;
  const stale = await ctx.db
    .query("waitlist")
    .withIndex("byLastActive", (q) =>
      q
        .eq("status", status)
        .gt("lastActive", null)
        .lt("lastActive", lastActiveCutoff)
    )
    // Handling the extreme edge case that too many people become inactive all at once
    .take(1000);
  await map(stale, ({ _id }) => ctx.db.delete(_id));
  return stale.length;
}

async function changeActiveSessionsCounter(ctx: MutationCtx, change: number) {
  const counter = await getActiveSessionsCounter(ctx);
  const count = Math.max(0, (counter?.count ?? 0) + change);
  if (counter === null) {
    await ctx.db.insert("waitlistCounters", { name: "active", count });
  } else {
    await ctx.db.patch(counter._id, { count });
  }
}
