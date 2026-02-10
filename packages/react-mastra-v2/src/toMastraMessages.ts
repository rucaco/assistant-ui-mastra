import type { ThreadMessage } from "@assistant-ui/react";

/**
 * A simplified CoreMessage type compatible with Mastra's agent.stream() input.
 * Mastra accepts CoreMessage[] (AI SDK v5 ModelMessage format).
 */
export type MastraCoreMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | MastraUserContentPart[] }
  | {
      role: "assistant";
      content: string | MastraAssistantContentPart[];
    }
  | {
      role: "tool";
      content: MastraToolResultPart[];
    };

type MastraUserContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "file"; data: string; mimeType: string };

type MastraAssistantContentPart =
  | { type: "text"; text: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    };

type MastraToolResultPart = {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
};

/**
 * Converts assistant-ui ThreadMessage[] to Mastra-compatible CoreMessage[].
 *
 * Tool calls and their results are split into separate assistant + tool
 * messages, matching the CoreMessage[] conversation structure Mastra expects.
 */
export function toMastraMessages(
  messages: readonly ThreadMessage[],
): MastraCoreMessage[] {
  const result: MastraCoreMessage[] = [];

  for (const message of messages) {
    switch (message.role) {
      case "system": {
        result.push({
          role: "system",
          content: message.content[0]?.text ?? "",
        });
        break;
      }

      case "user": {
        const parts: MastraUserContentPart[] = [];
        for (const part of message.content) {
          switch (part.type) {
            case "text":
              parts.push({ type: "text", text: part.text });
              break;
            case "image":
              parts.push({ type: "image", image: part.image });
              break;
            case "file":
              parts.push({
                type: "file",
                data: part.data,
                mimeType: part.mimeType,
              });
              break;
            // audio parts are not supported by Mastra CoreMessage
          }
        }

        // Also include attachment content if present
        if ("attachments" in message && message.attachments) {
          for (const attachment of message.attachments) {
            for (const part of attachment.content) {
              switch (part.type) {
                case "text":
                  parts.push({ type: "text", text: part.text });
                  break;
                case "image":
                  parts.push({ type: "image", image: part.image });
                  break;
                case "file":
                  parts.push({
                    type: "file",
                    data: part.data,
                    mimeType: part.mimeType,
                  });
                  break;
              }
            }
          }
        }

        // Use simple string if only one text part
        if (parts.length === 1 && parts[0]!.type === "text") {
          result.push({ role: "user", content: parts[0]!.text });
        } else {
          result.push({ role: "user", content: parts });
        }
        break;
      }

      case "assistant": {
        // Split assistant messages: text + tool-calls go in assistant message,
        // tool results go in a subsequent tool message.
        const assistantParts: MastraAssistantContentPart[] = [];
        const toolResults: MastraToolResultPart[] = [];

        for (const part of message.content) {
          switch (part.type) {
            case "text":
              assistantParts.push({ type: "text", text: part.text });
              break;
            case "tool-call":
              assistantParts.push({
                type: "tool-call",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args as Record<string, unknown>,
              });
              if (part.result !== undefined) {
                toolResults.push({
                  type: "tool-result",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  result: part.result,
                  isError: part.isError,
                });
              }
              break;
            // reasoning, source, file, image parts are not sent back to the model
          }
        }

        if (assistantParts.length > 0) {
          result.push({ role: "assistant", content: assistantParts });
        }
        if (toolResults.length > 0) {
          result.push({ role: "tool", content: toolResults });
        }
        break;
      }
    }
  }

  return result;
}
