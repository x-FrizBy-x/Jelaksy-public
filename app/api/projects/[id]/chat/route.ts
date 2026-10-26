import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { reserveChatUsage, settleChatUsage } from "@/lib/rate-limit";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_STORED_CHAT_MESSAGES,
  ProjectChatMessageSchema,
  ProjectChatResponseSchema,
  isRoadmapTaskComplete,
  normalizeRoadmapTaskProgress,
  ProjectRoadmapSchema,
} from "@/lib/project-planning";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const maxDuration = 60;

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const baseURL = process.env.OPENAI_BASE_URL?.trim();

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, ownerId: user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Roadmap generation is not configured. Set OPENAI_API_KEY to enable chat." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsedBody = RequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Message is invalid" }, { status: 400 });
  }

  const usageId = await reserveChatUsage(user.id);
  if (usageId === null) {
    return NextResponse.json(
      { error: "You've reached your usage limit for now. Please try again later." },
      { status: 429 }
    );
  }

  // History comes from the database, not the client, so it can't be forged or inflated.
  const storedHistory = Array.isArray(project.chatMessages)
    ? project.chatMessages.flatMap((entry) => {
        const parsed = ProjectChatMessageSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

  try {
    const chat = new ChatOpenAI({
      model,
      temperature: 0.3,
      maxTokens: 8000,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: baseURL ? { baseURL } : undefined,
    }).withStructuredOutput(ProjectChatResponseSchema, { includeRaw: true });

    const history = storedHistory.map((message) =>
      message.role === "user"
        ? new HumanMessage(message.content)
        : new AIMessage(message.content)
    );

    const { raw, parsed: response } = await chat.invoke([
      new SystemMessage(
        `You are Jelaksy, a thoughtful project-planning partner. Help the user shape the project "${project.name}". The user provided the following required project description as the starting brief: ${project.description || "No description is available for this older project."} Treat this description as the source of truth for the project and use it as the foundation for the roadmap. You can ask a user to provide more details but not ask the user to restate the project idea or provide a description. Reply conversationally and return a complete, practical roadmap that reflects both the description and the latest conversation. Organize it into clear phases with actionable tasks. Keep it concise and realistic, using as many phases and tasks per phase as the project actually needs. Let project complexity and dependencies determine the task count; do not force a fixed or uniform number. If a consequential detail is unclear, make a reasonable assumption, provide a useful draft anyway, and ask at most one focused follow-up question to refine it.`
      ),
      ...history,
      new HumanMessage(parsedBody.data.message),
    ]);

    // Replace the up-front estimate with real usage; if the provider reports
    // none, the estimate stands.
    const totalTokens = (raw as AIMessage).usage_metadata?.total_tokens;
    if (typeof totalTokens === "number") {
      await settleChatUsage(usageId, totalTokens);
    }

    if (!response) {
      throw new Error("The model response did not match the expected roadmap format.");
    }

    const latestProject = await prisma.project.findFirst({
      where: { id: project.id, ownerId: user.id },
      select: { roadmap: true },
    });
    const existingRoadmap = ProjectRoadmapSchema.safeParse(latestProject?.roadmap);
    const roadmap = normalizeRoadmapTaskProgress({
      ...response.roadmap,
      phases: response.roadmap.phases.map((phase) => {
        const existingPhase = existingRoadmap.success
          ? existingRoadmap.data.phases.find(
              (candidate) => candidate.title === phase.title
            )
          : undefined;

        const taskCompletion = phase.tasks.map((task) => {
          const existingTaskIndex = existingPhase?.tasks.indexOf(task) ?? -1;
          return existingTaskIndex >= 0 && existingPhase
            ? isRoadmapTaskComplete(existingPhase, existingTaskIndex)
            : false;
        });

        return {
          ...phase,
          taskCompletion,
          completed: existingPhase?.completed ?? false,
        };
      }),
    });
    const chatMessages = [
      ...storedHistory.slice(-(MAX_STORED_CHAT_MESSAGES - 2)),
      { role: "user" as const, content: parsedBody.data.message },
      { role: "assistant" as const, content: response.reply },
    ].slice(-MAX_STORED_CHAT_MESSAGES);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        roadmap,
        chatMessages,
      },
    });

    return NextResponse.json({ ...response, roadmap });
  } catch (error) {
    console.error("Failed to generate project roadmap:", error);
    return NextResponse.json(
      { error: "The AI couldn't respond right now. Please try again." },
      { status: 502 }
    );
  }
}
