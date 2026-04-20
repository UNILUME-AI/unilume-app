"use client";

import { useEffect, useReducer, useRef } from "react";
import type { SceneId } from "@/lib/selection/mock/scenes";
import {
  mockStream,
  applyEvent,
  createInitialState,
  type MockStreamEvent,
  type SelectionAgentState,
} from "@/lib/selection/mock/events";

/**
 * Reducer action — either a streaming event or a reset sentinel.
 * Kept in the hook file (not in events.ts) because "reset" is a hook
 * concern, not an event-source concern.
 */
type Action = MockStreamEvent | { kind: "__reset" };

function reducer(prev: SelectionAgentState, action: Action): SelectionAgentState {
  if (action.kind === "__reset") return createInitialState();
  return applyEvent(prev, action);
}

/**
 * Mock equivalent of `useChat` — drives the UI through a per-scene
 * streaming sequence. Returns a view-model that stays stable across
 * renders except when events are applied.
 *
 * Contract with future real `useChat`:
 *   - scene change → stream restarts (like a new user message)
 *   - unmount → in-flight stream is silently discarded
 *   - all async work is cancellable via the runId mechanism
 *
 * Swap path for #114: replace the `for await (of mockStream(...))` loop
 * with `for await (const event of aiStream)`, adapt events, reuse
 * `applyEvent`. Zero change to components consuming the returned state.
 */
export function useMockSelectionAgent(scene: SceneId): SelectionAgentState {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    createInitialState,
  );

  // Monotonic run id — incremented on every scene change or unmount
  // so any in-flight async loop knows it's been superseded.
  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    dispatch({ kind: "__reset" });

    (async () => {
      for await (const event of mockStream(scene)) {
        if (runIdRef.current !== runId) return; // superseded
        dispatch(event);
      }
    })();

    return () => {
      // Invalidate any still-running loop on unmount / scene-change.
      runIdRef.current += 1;
    };
  }, [scene]);

  return state;
}
