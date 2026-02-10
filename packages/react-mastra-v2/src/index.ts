// Runtime hook
export { useMastraNativeRuntime } from "./useMastraNativeRuntime";

// Adapter (for advanced usage / custom runtime composition)
export { MastraNativeAdapter } from "./MastraNativeAdapter";

// Message conversion utility
export { toMastraMessages } from "./toMastraMessages";
export type { MastraCoreMessage } from "./toMastraMessages";

// Types
export type {
  // Adapter config
  MastraNativeAdapterOptions,
  UseMastraNativeRuntimeOptions,

  // Chunk types (for onMastraEvent handlers)
  MastraChunk,
  MastraChunkBase,
  TextStartChunk,
  TextDeltaChunk,
  TextEndChunk,
  ReasoningStartChunk,
  ReasoningDeltaChunk,
  ReasoningEndChunk,
  ReasoningSignatureChunk,
  ToolCallChunk,
  ToolResultChunk,
  ToolCallStreamingStartChunk,
  ToolCallDeltaChunk,
  ToolCallStreamingEndChunk,
  ToolCallApprovalChunk,
  ToolCallSuspendedChunk,
  SourceChunk,
  FileChunk,
  OutputObjectChunk,
  StreamStartChunk,
  StepStartChunk,
  StepFinishChunk,
  FinishChunk,
  ErrorChunk,
  AbortChunk,
  ForceAbortChunk,
  ToolCallAccumulator,
} from "./types";
