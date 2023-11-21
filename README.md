# Convex Waitlist

An easy to adopt waitlist implementation using [Convex](https://convex.dev).
Read the [detailed guide](https://stack.convex.dev/wait-a-minute-won-t-you) to
this implementation on Stack.

## Overview

This repo includes a full-fledged implementation of a waitlist which can be used
to protect your app against surges in demand.

- The `Waitlist` component renders a replacement UI when the user must wait
  before they can use the app, as demonstrated in [`App.tsx`](./src/App.tsx)
- The waitlist backend keeps track of sessions and the number of active
  sessions, as defined in
  [`convex/waitlist/schema.ts`](./convex/waitlist/schema.ts)
- The waitlist is updated periodically via a cron defined in
  [`convex/waitlist/crons.ts`](./convex/waitlist/crons.ts)
- The read endpoints powering the UI and all database queries are defined in
  [`convex/waitlist/read.ts`](./convex/waitlist/read.ts)
- The waitlist session creation and refresh logic is in
  [`convex/waitlist/write.ts`](./convex/waitlist/write.ts)

## Configuration

The implementation uses the following environment variables, which can be
configured on the Convex dashboard (run `npx convex dashboard` to open it):

- `ACTIVE_SESSIONS_COUNT_LIMIT` how many active (not-waiting) sessions there can
  be at the same time. Defaults to 100, but you should really change this based
  on the number of users your app can handle.
- `WAITLIST_UPDATE_INTERVAL_SECONDS` how often the waitlist should be updated
  based on active sessions becoming inactive. Defaults to every 60 seconds.
- `ACTIVE_SESSION_TIMEOUT_SECONDS` for how long an active session can be
  inactive before it expires. Defaults to 5 minutes. Make this shorter if your
  app is highly interactive and you want users to move off of the waitlist
  faster.

## Adding waitlist to an existing app

1. Follow one of the Convex [quickstarts](https://docs.convex.dev/quickstarts)
   to get Convex set up.
   1. You don’t need to use Convex for anything else other than the waitlist
      (_but you really should_).
2. Copy the `convex/waitlist` folder from this repo into your `convex` folder
3. Set up crons. Adds the waitlist crons setup to your `convex/crons.ts` file:

   ```jsx
   import { cronJobs } from "convex/server";
   import { setupWaitlistCrons } from "./waitlist/crons";

   const crons = cronJobs();

   setupWaitlistCrons(crons);

   // ...your other crons, if any

   export default crons;
   ```

4. Set up the schema. Add the waitlist tables to your `convex/schema.ts` file:

   ```jsx
   import { defineSchema, defineTable } from "convex/server";
   import { waitlistTables } from "./waitlist/schema";

   export default defineSchema({
     ...waitlistTables,
     // ...your other tables, if any
   });
   ```

5. Protect your queries (read endpoints) by checking that the current session is
   active:

   ```jsx
   import { v } from "convex/values";
   import { query } from "./_generated/server";
   import { validateSessionIsActive } from "./waitlist/read";

   export const someRead = mutation({
     args: {
       // ... some arguments
       // any string will do as the user/session identifier
       sessionId: v.string(),
     },
     handler: async (ctx, args) => {
       // Check that the user is not still waiting
       await validateSessionIsActive(ctx, args.sessionId);

       // ... do whatever you need to do ...
     },
   });
   ```

6. Protect your mutations (write endpoints) by checking that the current session
   is active, and refresh the `lastActive` timestamp. See the
   [article](https://stack.convex.dev/wait-a-minute-won-t-you) for more details:

   ```jsx
   import { v } from "convex/values";
   import { mutation } from "./_generated/server";
   import { validateSessionAndRefreshLastActive } from "./waitlist/write";

   export const someWrite = mutation({
     args: {
       // ... some arguments
       // any string will do as the user/session identifier
       sessionId: v.string(),
     },
     handler: async (ctx, args) => {
       // Check that the user is not still waiting and
       // record that the user is actively using the app.
       await validateSessionAndRefreshLastActive(ctx, args.sessionId);

       // ... do whatever you need to do ...
     },
   });
   ```

7. Implement your UI. React is the simplest, but you could use another client if
   you’re willing to put in a little bit of time and effort.

   1. Copy the `src/waitlist` folder from this repo into your
      src/app/pages/lib/whatever client-side source folder
   2. Wrap your app in the `Waitlist` component, which takes the following
      props:
      - `loading` with what is shown while we’re loading the waitlist status
        from the server
      - `whileWaiting` to render the UI when the user is waiting
      - `sessionId` to identify the current user or session

   example:

   ```jsx
   import { Waitlist } from "./waitlist/Waitlist";

   export function App() {
     const sessionId = useSessionId();
     return (
       <Waitlist
         loading="Loading..."
         sessionId={sessionId}
         whileWaiting={(position, numWaiting) => (
           <p>
             You're on the wailist, thanks for your patience!
             <br />
             Your position in the line: {position} out of {numWaiting}.<br />
             Thanks for waiting.
           </p>
         )}
       >
         <p>You're no longer waiting! Congratz!</p>
       </Waitlist>
     );
   }
   ```

And you're done!
