"use client";

import { useLocalRuntime, INTERNAL, type AssistantRuntime } from "@assistant-ui/react";
import { MastraNativeAdapter } from "./MastraNativeAdapter";
import type { UseMastraNativeRuntimeOptions } from "./types";

const { splitLocalRuntimeOptions } = INTERNAL;

/**
 * Creates an assistant-ui runtime backed by Mastra's native fullStream format.
 *
 * This hook wraps `useLocalRuntime` with a `MastraNativeAdapter` that:
 * - Sends messages to your Mastra API route
 * - Reads the native fullStream chunks (not AI SDK Data Stream Protocol)
 * - Maps them to assistant-ui content parts (text, reasoning, tool calls, etc.)
 * - Forwards all chunks (including unknown types) to `onMastraEvent`
 *
 * @example
 * ```tsx
 * import { useMastraNativeRuntime } from "./useMastraNativeRuntime";
 * import { AssistantRuntimeProvider, Thread } from "@assistant-ui/react";
 *
 * function MyChat() {
 *   const runtime = useMastraNativeRuntime({
 *     api: "/api/mastra/chat",
 *     agentId: "my-agent",
 *     onMastraEvent: (chunk) => {
 *       // Handle workflow events, network routing, etc.
 *       if (chunk.type === "tool-call-approval") {
 *         // Show approval UI
 *       }
 *     },
 *   });
 *
 *   return (
 *     <AssistantRuntimeProvider runtime={runtime}>
 *       <Thread />
 *     </AssistantRuntimeProvider>
 *   );
 * }
 * ```
 */
export function useMastraNativeRuntime(
  options: UseMastraNativeRuntimeOptions,
): AssistantRuntime {
  const { localRuntimeOptions, otherOptions } =
    splitLocalRuntimeOptions(options);

  const adapter = new MastraNativeAdapter(otherOptions);

  return useLocalRuntime(adapter, localRuntimeOptions);
}
