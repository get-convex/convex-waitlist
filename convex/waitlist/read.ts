import { v } from "convex/values";
import { QueryCtx, query } from "../_generated/server";

// Defaults to 100.
export const ACTIVE_SESSIONS_COUNT_LIMIT = +(
  process.env.ACTIVE_SESSIONS_COUNT_LIMIT ?? 100
);

export const session = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, { sessionId }) => {
    const session = await getWaitlistSession(ctx, sessionId);
    if (session === null) {
      return null;
    }
    const { status, position } = session;
    return { status, position };
  },
});

export const global = query({
  args: {},
  handler: async (ctx) => {
    const head = await getWaitlistHead(ctx);
    const tail = await getWaitlistTail(ctx);
    return {
      firstWaitingPosition: head?.position ?? 0,
      lastWaitingPosition: tail?.position ?? 0,
    };
  },
});

export async function validateSessionIsActive(
  ctx: QueryCtx,
  sessionId: string
) {
  const session = await getWaitlistSession(ctx, sessionId);
  if (session?.status !== "active") {
    throw new Error(`Waitlist sessionId "${sessionId}" is not active`);
  }
}

export async function newSessionStatus(ctx: QueryCtx) {
  const activeSessionsCount = (await getActiveSessionsCounter(ctx))?.count ?? 0;
  return activeSessionsCount < ACTIVE_SESSIONS_COUNT_LIMIT
    ? "active"
    : "waiting";
}

export async function newSessionPosition(ctx: QueryCtx) {
  const tail = await getWaitlistTail(ctx);
  return (tail?.position ?? -1) + 1;
}

export async function getNumberOfWaiting(ctx: QueryCtx) {
  const head = await getWaitlistHead(ctx);
  const tail = await getWaitlistTail(ctx);
  return head === null || tail === null ? 0 : tail.position - head.position + 1;
}

export async function getWaitlistHead(ctx: QueryCtx) {
  return await ctx.db
    .query("waitlist")
    .withIndex("byStatus", (q) => q.eq("status", "waiting"))
    .first();
}

export async function getWaitlistTail(ctx: QueryCtx) {
  return await ctx.db
    .query("waitlist")
    .withIndex("byPosition")
    .order("desc")
    .first();
}

export async function getWaitlistSession(ctx: QueryCtx, sessionId: string) {
  return await ctx.db
    .query("waitlist")
    .withIndex("bySessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
}

export async function getActiveSessionsCounter(ctx: QueryCtx) {
  return await ctx.db
    .query("waitlistCounters")
    .withIndex("byName", (q) => q.eq("name", "active"))
    .unique();
}
