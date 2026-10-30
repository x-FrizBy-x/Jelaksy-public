import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnedProject, projectNotFound, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { releaseChatUsage, reserveChatUsage, settleChatUsage } from "@/lib/rate-limit";
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_STORED_CHAT_MESSAGES,
  ProjectChatMessageSchema,
  ProjectChatResponseSchema,
  describeRoadmapForModel,
  ensureRoadmapIds,
  mergeGeneratedRoadmap,
  ProjectRoadmapSchema,
  type ProjectRoadmap,
} from "@/lib/project-planning";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const maxDuration = 60;

const MAX_WRITE_ATTEMPTS = 3;

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const baseURL = process.env.OPENAI_BASE_URL?.trim();

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;
  const project = await getOwnedProject(id, user.id);

  if (!project) {
    return projectNotFound();
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

  const savedRoadmap = ProjectRoadmapSchema.safeParse(project.roadmap);
  const currentRoadmap = savedRoadmap.success
    ? ensureRoadmapIds(savedRoadmap.data)
    : null;

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
        `You are Jelaksy, a thoughtful project-planning partner. Help the user shape the project "${project.name}". The user provided the following required project description as the starting brief: ${project.description || "No description is available for this older project."} Treat this description as the source of truth for the project and use it as the foundation for the roadmap. You can ask a user to provide more details but not ask the user to restate the project idea or provide a description. Reply conversationally and return a complete, practical roadmap that reflects both the description and the latest conversation. Organize it into clear phases with actionable tasks. Keep it concise and realistic, using as many phases and tasks per phase as the project actually needs. Let project complexity and dependencies determine the task count; do not force a fixed or uniform number. If a consequential detail is unclear, make a reasonable assumption, provide a useful draft anyway, and ask at most one focused follow-up question to refine it.${
          currentRoadmap
            ? ` The user's current roadmap is below as JSON. Every phase and task has an "id". Keep the same id for every phase and task that is kept, even if you reword it or move it, because the id is how the user's checked-off progress is preserved. Use null as the id only for phases and tasks you newly add, and drop items that no longer belong. Current roadmap: ${describeRoadmapForModel(currentRoadmap)}`
            : " This is the first roadmap, so use null for every id."
        }`
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

    const chatMessages = [
      ...storedHistory.slice(-(MAX_STORED_CHAT_MESSAGES - 2)),
      { role: "user" as const, content: parsedBody.data.message },
      { role: "assistant" as const, content: response.reply },
    ].slice(-MAX_STORED_CHAT_MESSAGES);

    // The model call is slow, so progress may have been checked off meanwhile.
    // Merge against the latest roadmap and only write if it hasn't changed
    // since we read it, retrying the (cheap) merge otherwise.
    let roadmap: ProjectRoadmap | null = null;
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS && !roadmap; attempt++) {
      const latestProject = await getOwnedProject(project.id, user.id);
      if (!latestProject) {
        return projectNotFound();
      }

      const existingRoadmap = ProjectRoadmapSchema.safeParse(latestProject.roadmap);
      const merged = mergeGeneratedRoadmap(
        response.roadmap,
        existingRoadmap.success ? existingRoadmap.data : null
      );

      const updated = await prisma.project.updateMany({
        where: { id: project.id, ownerId: user.id, version: latestProject.version },
        data: { roadmap: merged, chatMessages, version: { increment: 1 } },
      });

      if (updated.count === 1) {
        roadmap = merged;
      }
    }

    if (!roadmap) {
      throw new Error("The roadmap kept changing while saving the AI response.");
    }

    return NextResponse.json({ ...response, roadmap });
  } catch (error) {
    console.error("Failed to generate project roadmap:", error);
    await releaseChatUsage(usageId).catch((releaseError) =>
      console.error("Failed to release chat usage:", releaseError)
    );
    return NextResponse.json(
      { error: "The AI couldn't respond right now. Please try again." },
      { status: 502 }
    );
  }
}
