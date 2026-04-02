import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { buildSystemPrompt } from "@/lib/prompts";
import { policyTools, marketTools } from "@/lib/tools";
import { vertex } from "@/lib/vertex";
import { auth } from "@clerk/nextjs/server";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      system: await buildSystemPrompt(),
      messages: await convertToModelMessages(messages),
      tools: { ...policyTools, ...marketTools },
      stopWhen: stepCountIs(3),
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 8192,
            includeThoughts: true,
          },
        },
      },
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
