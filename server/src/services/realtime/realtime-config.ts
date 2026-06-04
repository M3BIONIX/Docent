import { env } from "../../config/env.js";

/**
 * Builds the OpenAI Realtime session config sent to /v1/realtime/calls during
 * SDP negotiation. Shape ported from predint-voice-ai's interview-config.
 *
 * `instructions` is the whole-corpus teaching brief produced by /api/plan. The
 * agent teaches across ALL documents (the learner does not pick an order) and
 * probes for genuine understanding rather than accepting agreement.
 */
export function buildRealtimeSessionConfig(instructions: string) {
  return {
    type: "realtime",
    model: env.REALTIME_MODEL,
    output_modalities: ["audio"],
    audio: {
      input: {
        format: { type: "audio/pcm", rate: 24000 },
        turn_detection: { type: "semantic_vad" },
        transcription: { model: env.REALTIME_TRANSCRIBE_MODEL },
      },
      output: {
        format: { type: "audio/pcm", rate: 24000 },
        voice: env.REALTIME_VOICE,
      },
    },
    instructions,
    tool_choice: "auto",
    tools: [
      {
        type: "function",
        name: "end_session",
        description:
          "End the tutoring session only after you have already spoken a short warm closing line in audio. Call this when the learner has demonstrated solid understanding of all the material, or clearly wants to stop.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              enum: ["mastery_reached", "learner_requested_end"],
              description: "Why the session should end now.",
            },
            closingLine: {
              type: "string",
              description:
                "The short warm closing line you already spoke or are about to speak before ending.",
            },
          },
          required: ["reason", "closingLine"],
        },
      },
    ],
  };
}
