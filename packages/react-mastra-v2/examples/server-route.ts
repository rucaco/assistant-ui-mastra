/**
 * Example Next.js API route that streams Mastra's native fullStream as SSE.
 *
 * Place this at: app/api/mastra/chat/route.ts
 *
 * The client-side MastraNativeAdapter expects SSE events where each line is:
 *   data: <JSON-serialized Mastra ChunkType>\n\n
 * Terminated by:
 *   data: [DONE]\n\n
 */

// import { mastra } from "@/mastra"; // Your Mastra instance

export async function POST(req: Request) {
  const {
    messages,
    agentId = "default-agent",
    threadId,
    resourceId,
    system,
    // Spread any additional options you want to forward to agent.stream()
    ...streamOptions
  } = await req.json();

  // --- Get the agent -------------------------------------------------------
  // const agent = mastra.getAgent(agentId);
  // if (!agent) {
  //   return new Response(
  //     JSON.stringify({ error: `Agent '${agentId}' not found` }),
  //     { status: 404, headers: { "Content-Type": "application/json" } },
  //   );
  // }

  // --- Stream with Mastra's native format ----------------------------------
  // The default format ('mastra') returns a MastraModelOutput with fullStream.
  //
  // const stream = await agent.stream(messages, {
  //   // Wire up memory if threadId is provided
  //   ...(threadId && {
  //     memory: {
  //       thread: threadId,
  //       resource: resourceId ?? "default-user",
  //     },
  //   }),
  //   // Forward system prompt if the client sent one
  //   ...(system && { instructions: system }),
  //   // Forward any other options (maxSteps, toolChoice, etc.)
  //   ...streamOptions,
  // });

  // --- Pipe fullStream as SSE events ---------------------------------------
  // Each chunk from fullStream is a typed object like:
  //   { type: "text-delta", payload: { text: "..." }, from?: "...", runId?: "..." }
  //
  // We JSON-serialize each chunk and send it as an SSE data event.

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let closed = false;

      const enqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      try {
        // Uncomment when wired to real Mastra:
        // for await (const chunk of stream.fullStream) {
        //   if (closed) break;
        //   enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        // }

        // --- Demo: simulate a simple text stream ---------------------------
        const demoChunks = [
          { type: "start", payload: {} },
          { type: "text-delta", payload: { text: "Hello " } },
          { type: "text-delta", payload: { text: "from " } },
          { type: "text-delta", payload: { text: "Mastra!" } },
          {
            type: "finish",
            payload: {
              finishReason: "stop",
              usage: { promptTokens: 10, completionTokens: 3 },
            },
          },
        ];
        for (const chunk of demoChunks) {
          enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        // -------------------------------------------------------------------

        enqueue("data: [DONE]\n\n");
        close();
      } catch (error) {
        enqueue(
          `data: ${JSON.stringify({
            type: "error",
            payload: {
              error:
                error instanceof Error ? error.message : "Unknown error",
            },
          })}\n\n`,
        );
        close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
