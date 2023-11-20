import { useMutation, useQuery } from "convex/react";
import { ReactNode, useEffect } from "react";
import { api } from "../../convex/_generated/api";

const LIVENESS_PING_INTERVAL_MS = 1000;

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
  const active = useMutation(api.waitlist.write.active);
  useEffect(() => {
    const interval = setInterval(() => {
      void active({ sessionId });
    }, LIVENESS_PING_INTERVAL_MS);
    void active({ sessionId });
    return () => clearInterval(interval);
  }, [active, sessionId]);
  console.log();

  return sessionState === undefined || sessionState === null ? (
    loading ?? null
  ) : sessionState.status === "waiting" ? (
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

  if (globalState === undefined) {
    return loading;
  }
  const position = sessionState.position - globalState.firstWaitingPosition + 1;
  const numWaiting =
    globalState.lastWaitingPosition - globalState.firstWaitingPosition + 1;
  return whileWaiting(position, numWaiting);
}
