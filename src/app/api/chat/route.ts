/**
 * POST /api/chat
 *
 * AI 对话主入口. 请求体含历史消息数组, 响应是 Vercel AI SDK 的
 * UIMessage stream (Server-Sent Events, content-type: text/event-stream).
 *
 * 工具集: policyTools (Noon 政策) + marketTools (市场数据).
 * 模型: Gemini 2.5 Flash via Vertex AI.
 *
 * Schema: src/lib/api-schemas/chat.ts (ChatRequestSchema).
 */

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { buildSystemPrompt } from "@/lib/prompts";
import { policyTools, marketTools, categoryTools } from "@/lib/tools";
import { vertex } from "@/lib/vertex";
import { auth } from "@clerk/nextjs/server";
import { ChatRequestSchema } from "@/lib/api-schemas/chat";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.map(String).join(".") || "body";
    return Response.json(
      {
        error: `Invalid field '${field}': ${issue?.message ?? "validation failed"}`,
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { messages } = parsed.data;

  try {
    const result = streamText({
      model: vertex("gemini-2.5-flash"),
      system: await buildSystemPrompt(),
      messages: await convertToModelMessages(messages),
      tools: { ...policyTools, ...marketTools, ...categoryTools },
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
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
