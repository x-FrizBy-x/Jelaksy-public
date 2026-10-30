import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnedProject, projectNotFound, requireUser } from "@/lib/api";
import { ProjectRoadmapSchema, setTaskCompleted } from "@/lib/project-planning";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_WRITE_ATTEMPTS = 3;

const TaskCompletionSchema = z.object({
  phaseIndex: z.number().int().nonnegative(),
  taskIndex: z.number().int().nonnegative(),
  completed: z.boolean(),
}).strict();

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const parsedBody = TaskCompletionSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Task completion request is invalid" },
        { status: 400 }
      );
    }

    const { phaseIndex, taskIndex, completed } = parsedBody.data;

    // Optimistic concurrency: the write only lands if no one changed the
    // project since we read it; otherwise re-read and re-apply the toggle.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const project = await getOwnedProject(id, user.id);
      if (!project) {
        return projectNotFound();
      }

      const parsedRoadmap = ProjectRoadmapSchema.safeParse(project.roadmap);
      if (!parsedRoadmap.success) {
        return NextResponse.json(
          { error: "Project roadmap was not found" },
          { status: 409 }
        );
      }

      const result = setTaskCompleted(
        parsedRoadmap.data,
        phaseIndex,
        taskIndex,
        completed
      );

      if (!result.ok) {
        return NextResponse.json(
          {
            error:
              result.reason === "blocked"
                ? "Complete the previous task before continuing."
                : "Project roadmap task was not found",
          },
          { status: 409 }
        );
      }

      const updated = await prisma.project.updateMany({
        where: { id, ownerId: user.id, version: project.version },
        data: { roadmap: result.roadmap, version: { increment: 1 } },
      });

      if (updated.count === 1) {
        return NextResponse.json({ roadmap: result.roadmap });
      }
    }

    return NextResponse.json(
      { error: "The roadmap was changed by another request. Please try again." },
      { status: 409 }
    );
  } catch (error) {
    console.error("Failed to update task completion:", error);

    return NextResponse.json(
      { error: "Failed to update task completion" },
      { status: 500 }
    );
  }
}
