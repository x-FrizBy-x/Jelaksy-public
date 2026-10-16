import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ProjectChatMessageSchema,
  ProjectChatResponseSchema,
  isRoadmapTaskComplete,
  normalizeRoadmapTaskProgress,
  ProjectRoadmapSchema,
} from "@/lib/project-planning";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(ProjectChatMessageSchema).max(20),
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
    return NextResponse.json({ error: "Message or chat history is invalid" }, { status: 400 });
  }

  try {
    const chat = new ChatOpenAI({
      model,
      temperature: 0.3,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: baseURL ? { baseURL } : undefined,
    }).withStructuredOutput(ProjectChatResponseSchema);

    const history = parsedBody.data.history.map((message) =>
      message.role === "user"
        ? new HumanMessage(message.content)
        : new AIMessage(message.content)
    );

    const response = await chat.invoke([
      new SystemMessage(
        `You are Jelaksy, a thoughtful project-planning partner. Help the user shape the project "${project.name}". The user provided the following required project description as the starting brief: ${project.description || "No description is available for this older project."} Treat this description as the source of truth for the project and use it as the foundation for the roadmap. Do not ask the user to restate the project idea or provide a description. Reply conversationally and return a complete, practical roadmap that reflects both the description and the latest conversation. Organize it into clear phases with actionable tasks. Keep it concise and realistic, using as many phases and tasks per phase as the project actually needs. Let project complexity and dependencies determine the task count; do not force a fixed or uniform number. If a consequential detail is unclear, make a reasonable assumption, provide a useful draft anyway, and ask at most one focused follow-up question to refine it.`
      ),
      ...history,
      new HumanMessage(parsedBody.data.message),
    ]);

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
      ...parsedBody.data.history.slice(-18),
      { role: "user" as const, content: parsedBody.data.message },
      { role: "assistant" as const, content: response.reply },
    ].slice(-20);

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
