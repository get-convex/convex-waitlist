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
    const session = await getSession(ctx, sessionId);
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

export async function newSessionStatus(ctx: QueryCtx) {
  const activeSessionsCount = (await getCounter(ctx, "active"))?.count ?? 0;
  return activeSessionsCount < ACTIVE_SESSIONS_COUNT_LIMIT
    ? "active"
    : "waiting";
}

export async function newSessionPosition(ctx: QueryCtx) {
  const tail = await getWaitlistTail(ctx);
  return (tail?.position ?? -1) + 1;
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

export async function getSession(ctx: QueryCtx, sessionId: string) {
  return await ctx.db
    .query("waitlist")
    .withIndex("bySessionId", (q) => q.eq("sessionId", sessionId))
    .unique();
}

export async function getCounter(ctx: QueryCtx, status: "active") {
  return await ctx.db
    .query("waitlistCounters")
    .withIndex("byName", (q) => q.eq("name", status))
    .unique();
}
