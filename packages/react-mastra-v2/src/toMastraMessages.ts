import type { ThreadMessage } from "@assistant-ui/react";
import type { CoreMessage } from "@mastra/core";

/**
 * Converts assistant-ui ThreadMessage[] to Mastra-compatible CoreMessage[].
 *
 * CoreMessage is re-exported by @mastra/core from the AI SDK. Mastra's
 * agent.stream() accepts CoreMessage[] (among other formats) via its
 * MessageListInput type.
 *
 * Tool calls and their results are split into separate assistant + tool
 * messages, matching the CoreMessage[] conversation structure Mastra expects.
 */
export function toMastraMessages(
  messages: readonly ThreadMessage[],
): CoreMessage[] {
  const result: CoreMessage[] = [];

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
        const userParts: Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string }
          | { type: "file"; data: string; mimeType: string }
        > = [];

        for (const part of message.content) {
          switch (part.type) {
            case "text":
              userParts.push({ type: "text", text: part.text });
              break;
            case "image":
              userParts.push({ type: "image", image: part.image });
              break;
            case "file":
              userParts.push({
                type: "file",
                data: part.data,
                mimeType: part.mimeType,
              });
              break;
            // audio parts are not supported by CoreMessage
          }
        }

        // Also include attachment content if present
        if ("attachments" in message && message.attachments) {
          for (const attachment of message.attachments) {
            for (const part of attachment.content) {
              switch (part.type) {
                case "text":
                  userParts.push({ type: "text", text: part.text });
                  break;
                case "image":
                  userParts.push({ type: "image", image: part.image });
                  break;
                case "file":
                  userParts.push({
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
        if (userParts.length === 1 && userParts[0]!.type === "text") {
          result.push({ role: "user", content: userParts[0]!.text });
        } else {
          result.push({ role: "user", content: userParts } as CoreMessage);
        }
        break;
      }

      case "assistant": {
        // Split assistant messages: text + tool-calls go in assistant message,
        // tool results go in a subsequent tool message.
        const assistantParts: Array<
          | { type: "text"; text: string }
          | {
              type: "tool-call";
              toolCallId: string;
              toolName: string;
              args: Record<string, unknown>;
            }
        > = [];
        const toolResults: Array<{
          type: "tool-result";
          toolCallId: string;
          toolName: string;
          result: unknown;
          isError?: boolean;
        }> = [];

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
          result.push({
            role: "assistant",
            content: assistantParts,
          } as CoreMessage);
        }
        if (toolResults.length > 0) {
          result.push({ role: "tool", content: toolResults } as CoreMessage);
        }
        break;
      }
    }
  }

  return result;
}
