import { Crons } from "convex/server";
import { internal } from "../_generated/api";

// Defaults to 60 seconds.
const WAITLIST_UPDATE_INTERVAL_SECONDS = +(
  process.env.WAITLIST_UPDATE_INTERVAL_SECONDS ?? 60
);

export function setupWaitlistCrons(crons: Crons) {
  crons.interval(
    "waitlist.updateAll",
    { seconds: WAITLIST_UPDATE_INTERVAL_SECONDS },
    internal.waitlist.write.updateWaitlist
  );
}
