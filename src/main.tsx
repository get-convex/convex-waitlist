/* eslint-disable react-refresh/only-export-components */
import { ConvexProvider, ConvexReactClient } from "convex/react";
import React, { ReactNode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
// import App from "./App";
import "./index.css";
import { Waitlist } from "@/waitlist/Waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// ReactDOM.createRoot(document.getElementById("root")!).render(
//   <React.StrictMode>
//     <ConvexProvider client={convex}>
//       <App />
//     </ConvexProvider>
//   </React.StrictMode>
// );

function LoadTests() {
  const [toAdd, setToAdd] = useState(5);
  const [state, setState] = useState(
    [...Array(5)].map((_, i) => [true, i] as [boolean, number])
  );

  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setState((state) => {
              const newState = [...state];
              for (let i = 0; i < toAdd; i++) {
                newState.push([true, state.length + i]);
              }
              return newState;
            });
          }}
        >
          Add
        </Button>
        <Input
          value={toAdd}
          onChange={(event) => setToAdd(+event.target.value)}
        />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {state
          .filter(([live]) => live)
          .map(([, i]) => {
            console.log(i);

            return (
              <LoadTest
                key={i}
                i={i}
                button={
                  <Button
                    onClick={() => {
                      setState((state) => {
                        const newState = [...state];
                        newState[i][0] = false;
                        return newState;
                      });
                    }}
                  >
                    Leave
                  </Button>
                }
              />
            );
          })}
      </div>
    </div>
  );
}

function LoadTest({ button, i }: { button: ReactNode; i: number }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  useEffect(() => {
    const client = new ConvexReactClient(
      import.meta.env.VITE_CONVEX_URL as string
    );
    setClient(client);
    return () => {
      void client.close();
    };
  }, []);
  return (
    <div>
      {client === null ? (
        <div>Loading Convex...</div>
      ) : (
        <ConvexProvider client={client}>
          <Waitlist
            loading={<div>Loading...</div>}
            sessionId={"LoadTests " + i}
            whileWaiting={(position, numWaiting) => (
              <>
                {i} waiting {position}/{numWaiting} {button}
              </>
            )}
          >
            {i} active {button}
          </Waitlist>
        </ConvexProvider>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <LoadTests />
    </ConvexProvider>
  </React.StrictMode>
);
