import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ProjectChatMessageSchema,
  ProjectChatResponseSchema,
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
        `You are Jelaksy, a thoughtful project-planning partner. Help the user shape the project "${project.name}". ${
          project.description ? `Project description: ${project.description}` : ""
        } Reply conversationally and return a complete, practical project roadmap that reflects the latest conversation. Organize the roadmap into clear phases with actionable tasks. Keep the roadmap concise and realistic; use 3 to 6 phases and 2 to 5 tasks per phase when appropriate. If key information is missing, ask a focused question while still offering a useful draft roadmap.`
      ),
      ...history,
      new HumanMessage(parsedBody.data.message),
    ]);

    const latestProject = await prisma.project.findFirst({
      where: { id: project.id, ownerId: user.id },
      select: { roadmap: true },
    });
    const existingRoadmap = ProjectRoadmapSchema.safeParse(latestProject?.roadmap);
    const roadmap = {
      ...response.roadmap,
      phases: response.roadmap.phases.map((phase) => {
        const existingPhase = existingRoadmap.success
          ? existingRoadmap.data.phases.find(
              (candidate) => candidate.title === phase.title
            )
          : undefined;

        return { ...phase, completed: existingPhase?.completed ?? false };
      }),
    };
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
