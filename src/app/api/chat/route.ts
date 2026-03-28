import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { buildSystemPrompt } from "@/lib/prompts";
import { policyTools } from "@/lib/tools";
import { trimMessages } from "@/lib/context";
export const maxDuration = 60;

const vertex = createVertex({
  project: process.env.GOOGLE_VERTEX_PROJECT,
  location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-east5",
  googleAuthOptions: {
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}"),
  },
});

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Invalid request: messages must be a non-empty array" },
      { status: 400 }
    );
  }

  if (messages.length > 50) {
    return Response.json(
      { error: "Too many messages" },
      { status: 400 }
    );
  }

  try {
    const result = streamText({
      model: vertex("gemini-2.5-flash"),
      system: buildSystemPrompt(),
      messages: await convertToModelMessages(trimMessages(messages)),
      tools: policyTools,
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
