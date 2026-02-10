import type {
  ChatModelAdapter,
  LocalRuntimeOptions,
  ThreadMessage,
  ThreadStep,
} from "@assistant-ui/react";

// ---------------------------------------------------------------------------
// Mastra fullStream chunk types (mirrors @mastra/core/stream ChunkType)
// ---------------------------------------------------------------------------

/**
 * Base shape shared by every Mastra fullStream chunk.
 * `from` and `runId` are present in multi-agent / workflow contexts.
 */
export type MastraChunkBase = {
  from?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
};

// -- Text -------------------------------------------------------------------

export type TextStartChunk = MastraChunkBase & {
  type: "text-start";
  payload: { id?: string };
};

export type TextDeltaChunk = MastraChunkBase & {
  type: "text-delta";
  payload: { text: string; id?: string };
};

export type TextEndChunk = MastraChunkBase & {
  type: "text-end";
  payload: { id?: string };
};

// -- Reasoning --------------------------------------------------------------

export type ReasoningStartChunk = MastraChunkBase & {
  type: "reasoning-start";
  payload: { id?: string; signature?: string };
};

export type ReasoningDeltaChunk = MastraChunkBase & {
  type: "reasoning-delta";
  payload: { text: string; id?: string };
};

export type ReasoningEndChunk = MastraChunkBase & {
  type: "reasoning-end";
  payload: { id?: string; signature?: string };
};

export type ReasoningSignatureChunk = MastraChunkBase & {
  type: "reasoning-signature";
  payload: { id?: string; signature?: string };
};

// -- Tool Calls -------------------------------------------------------------

export type ToolCallChunk = MastraChunkBase & {
  type: "tool-call";
  payload: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  };
};

export type ToolResultChunk = MastraChunkBase & {
  type: "tool-result";
  payload: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
  };
};

export type ToolCallStreamingStartChunk = MastraChunkBase & {
  type: "tool-call-streaming-start";
  payload: {
    toolCallId: string;
    toolName: string;
  };
};

export type ToolCallDeltaChunk = MastraChunkBase & {
  type: "tool-call-delta";
  payload: {
    toolCallId: string;
    argsTextDelta: string;
    toolName?: string;
  };
};

export type ToolCallStreamingEndChunk = MastraChunkBase & {
  type: "tool-call-streaming-end";
  payload: { toolCallId?: string };
};

// -- Tool Approval (human-in-the-loop) --------------------------------------

export type ToolCallApprovalChunk = MastraChunkBase & {
  type: "tool-call-approval";
  payload: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    resumeSchema?: unknown;
  };
};

export type ToolCallSuspendedChunk = MastraChunkBase & {
  type: "tool-call-suspended";
  payload: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    suspendPayload?: unknown;
    resumeSchema?: unknown;
  };
};

// -- Sources & Files --------------------------------------------------------

export type SourceChunk = MastraChunkBase & {
  type: "source";
  payload: {
    id: string;
    sourceType: string;
    url?: string;
    title?: string;
    mimeType?: string;
    filename?: string;
  };
};

export type FileChunk = MastraChunkBase & {
  type: "file";
  payload: {
    data: string;
    mimeType: string;
    base64?: boolean;
  };
};

// -- Structured Output ------------------------------------------------------

export type OutputObjectChunk = MastraChunkBase & {
  type: "output-object";
  payload: unknown;
};

// -- Lifecycle --------------------------------------------------------------

export type StreamStartChunk = MastraChunkBase & {
  type: "start";
  payload: Record<string, unknown>;
};

export type StepStartChunk = MastraChunkBase & {
  type: "step-start";
  payload: { messageId?: string; request?: unknown };
};

export type StepFinishChunk = MastraChunkBase & {
  type: "step-finish";
  payload: {
    response?: unknown;
    usage?: { promptTokens: number; completionTokens: number };
    stepResult?: unknown;
    output?: unknown;
  };
};

export type FinishChunk = MastraChunkBase & {
  type: "finish";
  payload: {
    finishReason?: string;
    text?: string;
    usage?: { promptTokens: number; completionTokens: number };
    toolCalls?: unknown[];
    output?: unknown;
    messages?: unknown[];
  };
};

export type ErrorChunk = MastraChunkBase & {
  type: "error";
  payload: { error: unknown };
};

export type AbortChunk = MastraChunkBase & {
  type: "abort";
  payload: Record<string, unknown>;
};

// -- Safety -----------------------------------------------------------------

export type ForceAbortChunk = MastraChunkBase & {
  type: "force-abort";
  payload: Record<string, unknown>;
};

// -- Metadata ---------------------------------------------------------------

export type ResponseMetadataChunk = MastraChunkBase & {
  type: "response-metadata";
  payload: Record<string, unknown>;
};

export type ProviderMetadataChunk = MastraChunkBase & {
  type: "provider-metadata";
  payload: Record<string, unknown>;
};

// -- Unknown / Future -------------------------------------------------------

export type UnknownChunk = MastraChunkBase & {
  type: string;
  payload: unknown;
};

/**
 * Discriminated union of all known Mastra fullStream chunk types.
 * Unknown chunk types are handled via the catch-all `UnknownChunk`.
 */
export type MastraChunk =
  | TextStartChunk
  | TextDeltaChunk
  | TextEndChunk
  | ReasoningStartChunk
  | ReasoningDeltaChunk
  | ReasoningEndChunk
  | ReasoningSignatureChunk
  | ToolCallChunk
  | ToolResultChunk
  | ToolCallStreamingStartChunk
  | ToolCallDeltaChunk
  | ToolCallStreamingEndChunk
  | ToolCallApprovalChunk
  | ToolCallSuspendedChunk
  | SourceChunk
  | FileChunk
  | OutputObjectChunk
  | StreamStartChunk
  | StepStartChunk
  | StepFinishChunk
  | FinishChunk
  | ErrorChunk
  | AbortChunk
  | ForceAbortChunk
  | ResponseMetadataChunk
  | ProviderMetadataChunk
  | UnknownChunk;

// ---------------------------------------------------------------------------
// Adapter configuration
// ---------------------------------------------------------------------------

/** Internal state for a tool call being accumulated. */
export type ToolCallAccumulator = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;
  result?: unknown;
  isError?: boolean;
};

/**
 * Options for the Mastra native adapter.
 */
export type MastraNativeAdapterOptions = {
  /** URL of your Mastra streaming API route. */
  api: string;

  /** The Mastra agent ID to invoke. */
  agentId: string;

  /** Optional static body fields merged into every request. */
  body?: Record<string, unknown>;

  /** Request credentials mode. Defaults to "same-origin". */
  credentials?: RequestCredentials;

  /** Static headers or async header factory for auth tokens etc. */
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);

  /**
   * Called for EVERY Mastra chunk, including unknown/future types.
   * Use this to handle Mastra-specific events (workflow events, network
   * routing, tripwires, etc.) that don't map to assistant-ui content parts.
   */
  onMastraEvent?: (chunk: MastraChunk) => void;

  /** Called when the response is received (before streaming). */
  onResponse?: (response: Response) => void | Promise<void>;

  /** Called when streaming finishes successfully. */
  onFinish?: (message: ThreadMessage) => void;

  /** Called on errors. */
  onError?: (error: Error) => void;

  /** Called when the user cancels a running stream. */
  onCancel?: () => void;
};

/**
 * Options for the `useMastraNativeRuntime` hook.
 */
export type UseMastraNativeRuntimeOptions = MastraNativeAdapterOptions &
  LocalRuntimeOptions;
