"use client";

import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
  TextMessagePart,
  ReasoningMessagePart,
  ToolCallMessagePart,
  SourceMessagePart,
  FileMessagePart,
  ThreadStep,
} from "@assistant-ui/react";

import type {
  MastraChunk,
  MastraNativeAdapterOptions,
  ToolCallAccumulator,
} from "./types";
import { toMastraMessages } from "./toMastraMessages";

/**
 * A ChatModelAdapter that consumes Mastra's native fullStream format.
 *
 * The server sends Mastra ChunkType objects as SSE events ("data: {json}\n\n").
 * This adapter accumulates them into assistant-ui ChatModelRunResult snapshots
 * and yields them as an async generator for useLocalRuntime.
 *
 * Every chunk -- including unknown/future types -- is forwarded to the
 * optional `onMastraEvent` callback, so your app can handle Mastra-specific
 * events (workflow state, network routing, tripwires, etc.) outside the
 * chat message model.
 */
export class MastraNativeAdapter implements ChatModelAdapter {
  constructor(private options: MastraNativeAdapterOptions) {}

  async *run({
    messages,
    abortSignal,
    context,
    unstable_getMessage,
  }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    // Wire up cancellation callback
    abortSignal.addEventListener(
      "abort",
      () => {
        if (!abortSignal.reason?.detach) this.options.onCancel?.();
      },
      { once: true },
    );

    // Resolve headers
    const headersValue =
      typeof this.options.headers === "function"
        ? await this.options.headers()
        : this.options.headers;
    const headers = new Headers(headersValue);
    headers.set("Content-Type", "application/json");

    // Convert messages and build request body
    const mastraMessages = toMastraMessages(messages);
    const body = {
      messages: mastraMessages,
      agentId: this.options.agentId,
      // Forward system prompt if set via model context
      ...(context.system ? { system: context.system } : undefined),
      ...this.options.body,
    };

    const response = await fetch(this.options.api, {
      method: "POST",
      headers,
      credentials: this.options.credentials ?? "same-origin",
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    await this.options.onResponse?.(response);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Mastra API error ${response.status}: ${text}`);
    }
    if (!response.body) {
      throw new Error("Mastra API returned no response body");
    }

    // -----------------------------------------------------------------------
    // Accumulator state
    // -----------------------------------------------------------------------
    let textContent = "";
    let reasoningContent = "";
    const toolCalls = new Map<string, ToolCallAccumulator>();
    const sources: SourceMessagePart[] = [];
    const files: FileMessagePart[] = [];
    const steps: ThreadStep[] = [];

    const buildContent = (): ThreadAssistantMessagePart[] => {
      const parts: ThreadAssistantMessagePart[] = [];

      if (reasoningContent) {
        parts.push({
          type: "reasoning",
          text: reasoningContent,
        } satisfies ReasoningMessagePart);
      }

      if (textContent) {
        parts.push({
          type: "text",
          text: textContent,
        } satisfies TextMessagePart);
      }

      for (const tc of toolCalls.values()) {
        parts.push({
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
          argsText: tc.argsText,
          result: tc.result,
          isError: tc.isError,
        } satisfies ToolCallMessagePart);
      }

      parts.push(...sources);
      parts.push(...files);

      return parts;
    };

    const buildMetadata = ():
      | ChatModelRunResult["metadata"]
      | undefined => {
      if (steps.length === 0) return undefined;
      return { steps };
    };

    // -----------------------------------------------------------------------
    // SSE stream reader
    // -----------------------------------------------------------------------
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            // Stream signaled completion without a finish chunk.
            // Yield final state.
            const hasUnresolved = Array.from(toolCalls.values()).some(
              (tc) => tc.result === undefined,
            );
            yield {
              content: buildContent(),
              status: hasUnresolved
                ? { type: "requires-action", reason: "tool-calls" }
                : { type: "complete", reason: "stop" },
              metadata: buildMetadata(),
            };
            this.options.onFinish?.(unstable_getMessage());
            return;
          }

          let chunk: MastraChunk;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue; // skip malformed events
          }

          // Forward every chunk to the escape-hatch callback
          this.options.onMastraEvent?.(chunk);

          // Process known chunk types
          let shouldYield = false;

          switch (chunk.type) {
            // -- Text -------------------------------------------------------
            case "text-delta":
              textContent += chunk.payload.text;
              shouldYield = true;
              break;

            // -- Reasoning --------------------------------------------------
            case "reasoning-delta":
              reasoningContent += chunk.payload.text;
              shouldYield = true;
              break;

            // -- Tool calls (complete) --------------------------------------
            case "tool-call":
              toolCalls.set(chunk.payload.toolCallId, {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                argsText: JSON.stringify(chunk.payload.args),
              });
              shouldYield = true;
              break;

            // -- Tool call argument streaming --------------------------------
            case "tool-call-streaming-start":
              toolCalls.set(chunk.payload.toolCallId, {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: {},
                argsText: "",
              });
              shouldYield = true;
              break;

            case "tool-call-delta": {
              const tc = toolCalls.get(chunk.payload.toolCallId);
              if (tc) {
                tc.argsText += chunk.payload.argsTextDelta;
                // Try to parse partial args for display
                try {
                  tc.args = JSON.parse(tc.argsText);
                } catch {
                  // args text is still partial, keep accumulating
                }
              }
              shouldYield = true;
              break;
            }

            case "tool-call-streaming-end": {
              if (chunk.payload.toolCallId) {
                const tc = toolCalls.get(chunk.payload.toolCallId);
                if (tc) {
                  try {
                    tc.args = JSON.parse(tc.argsText);
                  } catch {
                    // malformed args
                  }
                }
              }
              shouldYield = true;
              break;
            }

            // -- Tool results -----------------------------------------------
            case "tool-result": {
              const existing = toolCalls.get(chunk.payload.toolCallId);
              if (existing) {
                existing.result = chunk.payload.result;
                existing.isError = chunk.payload.isError;
              }
              shouldYield = true;
              break;
            }

            // -- Tool approval / suspension (human-in-the-loop) -------------
            case "tool-call-approval":
            case "tool-call-suspended": {
              const tcId = chunk.payload.toolCallId;
              if (!toolCalls.has(tcId)) {
                toolCalls.set(tcId, {
                  toolCallId: tcId,
                  toolName: chunk.payload.toolName,
                  args: chunk.payload.args,
                  argsText: JSON.stringify(chunk.payload.args),
                });
              }
              // Signal that the message requires human action
              yield {
                content: buildContent(),
                status: { type: "requires-action", reason: "tool-calls" },
                metadata: buildMetadata(),
              };
              // Don't return -- let the stream continue if the server resumes
              continue;
            }

            // -- Sources & files --------------------------------------------
            case "source":
              sources.push({
                type: "source",
                sourceType: "url",
                id: chunk.payload.id,
                url: chunk.payload.url ?? "",
                title: chunk.payload.title,
              });
              shouldYield = true;
              break;

            case "file":
              files.push({
                type: "file",
                data: chunk.payload.data,
                mimeType: chunk.payload.mimeType,
              });
              shouldYield = true;
              break;

            // -- Step lifecycle ---------------------------------------------
            case "step-finish":
              if (chunk.payload.usage) {
                steps.push({ usage: chunk.payload.usage });
              }
              break; // no yield needed for step boundaries

            // -- Terminal states --------------------------------------------
            case "finish": {
              const hasUnresolved = Array.from(toolCalls.values()).some(
                (tc) => tc.result === undefined,
              );
              yield {
                content: buildContent(),
                status: hasUnresolved
                  ? { type: "requires-action", reason: "tool-calls" }
                  : { type: "complete", reason: "stop" },
                metadata: buildMetadata(),
              };
              this.options.onFinish?.(unstable_getMessage());
              return;
            }

            case "error":
              yield {
                content: buildContent(),
                status: {
                  type: "incomplete",
                  reason: "error",
                  error: String(chunk.payload.error),
                },
                metadata: buildMetadata(),
              };
              return;

            case "force-abort":
              yield {
                content: buildContent(),
                status: { type: "incomplete", reason: "content-filter" },
                metadata: buildMetadata(),
              };
              return;

            case "abort":
              yield {
                content: buildContent(),
                status: { type: "incomplete", reason: "cancelled" },
                metadata: buildMetadata(),
              };
              return;

            // -- Everything else (start, text-start, text-end, etc.) --------
            // These are lifecycle signals that don't change displayed content.
            // They've already been forwarded to onMastraEvent above.
            default:
              break;
          }

          if (shouldYield) {
            yield {
              content: buildContent(),
              status: { type: "running" },
              metadata: buildMetadata(),
            };
          }
        }
      }

      // Stream ended without a finish chunk -- yield current state
      yield {
        content: buildContent(),
        status: { type: "complete", reason: "stop" },
        metadata: buildMetadata(),
      };
      this.options.onFinish?.(unstable_getMessage());
    } catch (error: unknown) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }
}
