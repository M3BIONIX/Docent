import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../config/env.js";
import { OpenAiNotConfiguredError } from "../../services/openai/openai.factory.js";
import { extractJsonObjectString } from "../../services/evaluator/evaluator.parse.js";
import type { PlanRequest, PlanResponse } from "./plan.dto.js";

interface PlanTopic {
  title: string;
  keyPoints: string[];
}

const MAX_CHARS_PER_DOC = 8_000;

function planModel() {
  if (!env.OPENAI_API_KEY) throw new OpenAiNotConfiguredError();
  return createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.PLAN_MODEL);
}

function buildPlannerPrompt(docs: PlanRequest["docs"]): string {
  const corpus = docs
    .map((d, i) => `### Document ${i + 1}: ${d.title}\n${d.text.slice(0, MAX_CHARS_PER_DOC)}`)
    .join("\n\n");

  return [
    "You are designing a tutoring curriculum that spans ALL of the documents below, taught as one connected body of knowledge.",
    "Return exactly one JSON object, no markdown, with keys:",
    '  "overview": a 2-3 sentence description of what the learner will understand by the end (plain text).',
    '  "topics": an ordered array (cover the whole corpus) of objects { "title": string, "keyPoints": string[] }.',
    "Order topics pedagogically (foundational ideas first), NOT by document order. Merge overlapping ideas across documents into single topics.",
    "Each topic should have 2-5 concrete keyPoints a learner must be able to explain in their own words.",
    "",
    "SOURCE DOCUMENTS:",
    corpus,
  ].join("\n");
}

const FIXED_PEDAGOGY = [
  "# YOUR ROLE",
  "You are Docent, a warm but rigorous voice tutor. You teach the learner the material below, spanning all of it as one connected subject. YOU decide the order; the learner does not pick.",
  "",
  "# HOW TO TEACH (spoken, one idea at a time)",
  "- Explain one idea clearly and briefly, then CHECK understanding before moving on.",
  "- Check understanding by asking the learner to explain the idea in their OWN words, give an example, or apply it. Never settle for yes/no.",
  "- If the learner only says 'yes', 'ok', or agrees without explaining, do NOT accept it as understanding. Ask them to explain it back.",
  "- If they are wrong or vague, gently correct and re-teach, then re-check.",
  "- Keep turns short and conversational. Ask exactly one question at a time. Never lecture for long.",
  "- Move through ALL topics. Only call end_session once the learner has genuinely demonstrated understanding across the material.",
  "- Speak naturally; do not read these instructions aloud.",
].join("\n");

export async function buildPlan(req: PlanRequest): Promise<PlanResponse> {
  const { text } = await generateText({
    model: planModel(),
    prompt: buildPlannerPrompt(req.docs),
  });

  let overview = "";
  let topics: PlanTopic[] = [];
  const json = extractJsonObjectString(text);
  if (json) {
    try {
      const parsed = JSON.parse(json) as { overview?: string; topics?: PlanTopic[] };
      overview = typeof parsed.overview === "string" ? parsed.overview.trim() : "";
      topics = Array.isArray(parsed.topics)
        ? parsed.topics
            .filter((t) => t && typeof t.title === "string")
            .map((t) => ({
              title: t.title.trim(),
              keyPoints: Array.isArray(t.keyPoints)
                ? t.keyPoints.filter((k) => typeof k === "string").map((k) => k.trim())
                : [],
            }))
        : [];
    } catch {
      /* fall through to fallback below */
    }
  }

  if (topics.length === 0) {
    // Fallback: one topic per document title so the session can still run.
    topics = req.docs.map((d) => ({ title: d.title, keyPoints: [] }));
    overview = overview || "Understand the key ideas across all of the provided documents.";
  }

  const topicBlock = topics
    .map(
      (t, i) =>
        `${i + 1}. ${t.title}${t.keyPoints.length ? "\n   - " + t.keyPoints.join("\n   - ") : ""}`,
    )
    .join("\n");

  const instructions = [
    FIXED_PEDAGOGY,
    "",
    "# WHAT THE LEARNER SHOULD UNDERSTAND",
    overview,
    "",
    "# TOPICS TO TEACH (in this order)",
    topicBlock,
    "",
    "Begin by warmly greeting the learner and starting with the first topic.",
  ].join("\n");

  return { instructions, topics: topics.map((t) => t.title) };
}
