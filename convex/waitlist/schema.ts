import { defineTable } from "convex/server";
import { v } from "convex/values";

export const waitlistTables = {
  waitlist: defineTable({
    sessionId: v.string(),
    position: v.number(),
    status: v.union(v.literal("waiting"), v.literal("active")),
    lastActive: v.number(),
  })
    .index("bySessionId", ["sessionId"])
    .index("byPosition", ["position"])
    .index("byStatus", ["status", "position"])
    .index("byLastActive", ["status", "lastActive"]),
  waitlistCounters: defineTable({
    name: v.literal("active"),
    count: v.number(),
  }).index("byName", ["name"]),
};
