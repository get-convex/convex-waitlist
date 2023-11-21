import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Link } from "@/components/typography/link";
import { Waitlist } from "@/waitlist/Waitlist";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

function App() {
  const sessionId = useSessionId();

  return (
    <main className="container max-w-2xl flex flex-col gap-8">
      <h1 className="text-4xl font-extrabold my-8 text-center">
        Convex Waitlist Demo
      </h1>
      <Waitlist
        loading={<Skeleton className="w-1/2 h-8" />}
        sessionId={sessionId}
        whileWaiting={(position, numWaiting) => (
          <>
            <p>
              <span className="font-bold">
                You're on the wailist, thanks for your patience!
              </span>
              <br />
              You're {formatCardinal(position)} of {numWaiting} in the line...
              Hang tight.
            </p>
            <Skeleton className="w-1/2 h-8" />
          </>
        )}
      >
        <NumbersDemo sessionId={sessionId} />
      </Waitlist>
      <p>
        Check out{" "}
        <Link target="_blank" href="https://docs.convex.dev/home">
          Convex docs
        </Link>
      </p>
    </main>
  );
}

function formatCardinal(x: number) {
  const suffix = ["th", "st", "nd", "rd"];
  const v = x % 100;
  return x + (suffix[(v - 20) % 10] ?? suffix[v] ?? suffix[0]);
}

function NumbersDemo({ sessionId }: { sessionId: string }) {
  const numbers = useQuery(api.myFunctions.listNumbers, {
    count: 10,
    sessionId,
  });
  const addNumber = useMutation(api.myFunctions.addNumber);
  return (
    <>
      <p>
        Click the button and open this page in another window - this data is
        persisted in the Convex cloud database!
      </p>
      <p>
        <Button
          onClick={() => {
            void addNumber({
              value: Math.floor(Math.random() * 10),
              sessionId,
            });
          }}
        >
          Add a random number
        </Button>
      </p>
      <p>
        Numbers:{" "}
        {numbers?.length === 0
          ? "Click the button!"
          : numbers?.join(", ") ?? "..."}
      </p>
    </>
  );
}

const STORE = (typeof window === "undefined" ? null : window)?.sessionStorage;
const STORE_KEY = "ConvexSessionId";

function useSessionId() {
  const [sessionId] = useState(
    () => STORE?.getItem(STORE_KEY) ?? crypto.randomUUID()
  );

  useEffect(() => {
    STORE?.setItem(STORE_KEY, sessionId);
  }, [sessionId]);

  return sessionId;
}

export default App;
