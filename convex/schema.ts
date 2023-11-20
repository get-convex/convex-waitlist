import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    sessionId: v.string(),
    position: v.number(),
    status: v.union(v.literal("waiting"), v.literal("active")),
    expireId: v.id("_scheduled_functions"),
  })
    .index("bySessionId", ["sessionId"])
    .index("byPosition", ["position"])
    .index("byStatus", ["status", "position"]),
  waitlistCounters: defineTable({
    name: v.literal("active"),
    count: v.number(),
  }).index("byName", ["name"]),
  // Only for example UI
  numbers: defineTable({
    value: v.number(),
  }),
});
