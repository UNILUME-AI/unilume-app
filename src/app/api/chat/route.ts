import { streamText, stepCountIs } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { buildSystemPrompt } from "@/lib/prompts";
import { policyTools } from "@/lib/tools";

export const maxDuration = 60;

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION,
  googleAuthOptions: {
    credentials: JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"
    ),
  },
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: vertex("claude-sonnet-4@20250514"),
    system: buildSystemPrompt(),
    messages,
    tools: policyTools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
