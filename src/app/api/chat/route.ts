import { streamText, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { policyTools } from "@/lib/tools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(),
    messages,
    tools: policyTools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
