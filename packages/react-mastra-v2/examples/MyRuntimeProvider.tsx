"use client";

/**
 * Example RuntimeProvider for a Kangaroi-style app using:
 *   - Mastra v1 (native streaming)
 *   - assistant-ui (primitives)
 *   - Mantine UI / CSS Modules (styling layer)
 *   - Zustand (app state -- coexists with assistant-ui's internal Zustand stores)
 *
 * This component wires up the Mastra native runtime and provides it to
 * all assistant-ui primitives below it in the tree.
 */

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useMastraNativeRuntime } from "../src/useMastraNativeRuntime";
import type { MastraChunk } from "../src/types";
import { useCallback, type ReactNode } from "react";

// -- Your app's Zustand store (example) -------------------------------------
// import { useAppStore } from "@/stores/appStore";

type Props = {
  children: ReactNode;
  agentId?: string;
  threadId?: string;
};

export function MyRuntimeProvider({
  children,
  agentId = "default-agent",
  threadId,
}: Props) {
  // Example: pull auth token from your app's state
  // const authToken = useAppStore((s) => s.authToken);

  // Handle Mastra-specific events that don't map to chat messages
  const handleMastraEvent = useCallback((chunk: MastraChunk) => {
    switch (chunk.type) {
      // -- Tool approval (human-in-the-loop) --------------------------------
      case "tool-call-approval":
        console.log(
          `[Mastra] Tool "${chunk.payload.toolName}" needs approval`,
          chunk.payload,
        );
        // Show an approval modal in your Mantine UI, e.g.:
        // openApprovalModal({ toolCall: chunk.payload });
        break;

      case "tool-call-suspended":
        console.log(
          `[Mastra] Tool "${chunk.payload.toolName}" suspended`,
          chunk.payload,
        );
        break;

      // -- Step boundaries (useful for progress indicators) -----------------
      case "step-start":
        console.log("[Mastra] Step started", chunk.payload);
        break;
      case "step-finish":
        console.log("[Mastra] Step finished", chunk.payload);
        break;

      // -- Safety -----------------------------------------------------------
      case "force-abort":
        console.warn("[Mastra] Content blocked by output processor");
        break;

      // -- Multi-agent context ----------------------------------------------
      // chunk.from tells you which agent emitted this chunk in a network
      default:
        if (chunk.from) {
          // This chunk came from a sub-agent in a Mastra network
          console.log(`[Mastra] Event from agent "${chunk.from}":`, chunk.type);
        }
        break;
    }
  }, []);

  const runtime = useMastraNativeRuntime({
    // -- Required -----------------------------------------------------------
    api: "/api/mastra/chat",
    agentId,

    // -- Mastra-specific ----------------------------------------------------
    onMastraEvent: handleMastraEvent,

    // -- Request customization ----------------------------------------------
    body: {
      // Pass threadId for memory persistence
      ...(threadId && { threadId }),
      // Any other static fields your API route expects
    },

    // Example: dynamic auth headers
    // headers: async () => ({
    //   Authorization: `Bearer ${authToken}`,
    // }),

    // -- assistant-ui options -----------------------------------------------
    // maxSteps: 5, // Allow multi-step tool calling (default: 2)

    // -- Lifecycle callbacks ------------------------------------------------
    onError: (error) => {
      console.error("[Mastra] Stream error:", error);
      // Show a Mantine notification:
      // notifications.show({ color: "red", message: error.message });
    },
    onFinish: (message) => {
      console.log("[Mastra] Message complete:", message.id);
    },
    onCancel: () => {
      console.log("[Mastra] Stream cancelled by user");
    },

    // -- Adapters (optional) ------------------------------------------------
    // adapters: {
    //   attachments: myAttachmentAdapter,
    //   feedback: myFeedbackAdapter,
    //   speech: mySpeechAdapter,
    // },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

/**
 * Example: Wrapping assistant-ui primitives with Mantine UI.
 *
 * assistant-ui primitives are unstyled and composable -- they expose refs,
 * data attributes, and the `asChild` prop. You can wrap them with Mantine
 * components and apply CSS Modules classes freely.
 *
 * ```tsx
 * import { ThreadPrimitive, MessagePrimitive, ComposerPrimitive } from "@assistant-ui/react";
 * import { Paper, Text, Textarea, Button, Stack } from "@mantine/core";
 * import classes from "./Chat.module.css";
 *
 * // The thread container
 * function ChatThread() {
 *   return (
 *     <ThreadPrimitive.Root className={classes.thread}>
 *       <ThreadPrimitive.Viewport className={classes.viewport}>
 *         <ThreadPrimitive.Messages
 *           components={{
 *             UserMessage: UserBubble,
 *             AssistantMessage: AssistantBubble,
 *           }}
 *         />
 *       </ThreadPrimitive.Viewport>
 *       <ChatComposer />
 *     </ThreadPrimitive.Root>
 *   );
 * }
 *
 * // A user message wrapped in Mantine Paper
 * function UserBubble() {
 *   return (
 *     <MessagePrimitive.Root className={classes.userMessage}>
 *       <Paper shadow="xs" p="md" radius="lg" className={classes.userBubble}>
 *         <MessagePrimitive.Content />
 *       </Paper>
 *     </MessagePrimitive.Root>
 *   );
 * }
 *
 * // An assistant message with reasoning display
 * function AssistantBubble() {
 *   return (
 *     <MessagePrimitive.Root className={classes.assistantMessage}>
 *       <Paper shadow="xs" p="md" radius="lg" className={classes.assistantBubble}>
 *         <MessagePrimitive.Content
 *           components={{
 *             Text: ({ text }) => <Text size="sm">{text}</Text>,
 *             Reasoning: ({ text }) => (
 *               <Text size="xs" c="dimmed" fs="italic">{text}</Text>
 *             ),
 *             ToolCall: ({ toolName, args }) => (
 *               <Paper withBorder p="xs">
 *                 <Text size="xs" fw={600}>{toolName}</Text>
 *                 <Text size="xs" c="dimmed">{JSON.stringify(args)}</Text>
 *               </Paper>
 *             ),
 *           }}
 *         />
 *       </Paper>
 *     </MessagePrimitive.Root>
 *   );
 * }
 *
 * // Composer using Mantine Textarea
 * function ChatComposer() {
 *   return (
 *     <ComposerPrimitive.Root className={classes.composer}>
 *       <ComposerPrimitive.Input asChild>
 *         <Textarea placeholder="Message..." autosize minRows={1} maxRows={4} />
 *       </ComposerPrimitive.Input>
 *       <ComposerPrimitive.Send asChild>
 *         <Button size="sm">Send</Button>
 *       </ComposerPrimitive.Send>
 *     </ComposerPrimitive.Root>
 *   );
 * }
 * ```
 */
