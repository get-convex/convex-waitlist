import { useConvex, useMutation, useQuery } from "convex/react";
import { ReactNode, useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { getFunctionName } from "convex/server";

export function Waitlist({
  loading,
  sessionId,
  whileWaiting,
  children,
}: {
  loading?: ReactNode;
  sessionId: string;
  whileWaiting?: (position: number, numWaiting: number) => ReactNode;
  children: ReactNode;
}) {
  const sessionState = useQuery(api.waitlist.read.session, { sessionId });
  const join = useMutation(api.waitlist.write.join);
  const status = sessionState?.status;
  useEffect(() => {
    // Join initially and if switched back to waiting
    if (status === undefined || status === "waiting") {
      void join({ sessionId });
    }
  }, [join, sessionId, status]);

  return sessionState === undefined || sessionState === null ? (
    loading ?? null
  ) : status === "waiting" ? (
    whileWaiting === undefined ? null : (
      <OnWaitlist
        loading={loading}
        whileWaiting={whileWaiting}
        sessionId={sessionId}
      />
    )
  ) : (
    children
  );
}

function OnWaitlist({
  loading,
  sessionId,
  whileWaiting,
}: {
  loading: ReactNode;
  sessionId: string;
  whileWaiting: (position: number, numWaiting: number) => ReactNode;
}) {
  const sessionState = useQuery(api.waitlist.read.session, { sessionId })!;
  const globalState = useQuery(api.waitlist.read.global);
  useTrackVisiblityChanges(sessionId);

  if (globalState === undefined) {
    return loading;
  }
  const position = sessionState.position - globalState.firstWaitingPosition + 1;
  const numWaiting =
    globalState.lastWaitingPosition - globalState.firstWaitingPosition + 1;
  return whileWaiting(position, numWaiting);
}

function useTrackVisiblityChanges(sessionId: string) {
  const convex = useConvex();
  useEffect(() => {
    const listener = () => {
      void fetch((convex as any).address + "/api/mutation", {
        body: JSON.stringify({
          path: getFunctionName(
            document.visibilityState === "hidden"
              ? api.waitlist.write.leave
              : api.waitlist.write.join
          ),
          args: { sessionId },
          format: "json",
        }),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        keepalive: true,
      });
    };
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  });
}
