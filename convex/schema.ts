import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { waitlistTables } from "./waitlist/schema";

export default defineSchema({
  ...waitlistTables,
  // Only for example UI
  numbers: defineTable({
    value: v.number(),
  }),
});
