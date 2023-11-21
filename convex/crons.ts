import { cronJobs } from "convex/server";
import { setupWaitlistCrons } from "./waitlist/crons";

const crons = cronJobs();

setupWaitlistCrons(crons);

export default crons;
