import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import {
  isRoadmapTaskComplete,
  normalizeRoadmapTaskProgress,
  ProjectRoadmapSchema,
} from "@/lib/project-planning";

const TaskCompletionSchema = z.object({
  phaseIndex: z.number().int().nonnegative(),
  taskIndex: z.number().int().nonnegative(),
  completed: z.boolean(),
}).strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } 
    
  catch (error) {
    console.error("Failed to fetch project:", error);

    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}


export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body is invalid" },
        { status: 400 }
      );
    }

    const fields = body as Record<string, unknown>;

    if (fields.phaseCompletion !== undefined) {
      return NextResponse.json(
        { error: "Phase completion is derived from its tasks." },
        { status: 400 }
      );
    }

    if (fields.taskCompletion !== undefined) {
      const parsedCompletion = TaskCompletionSchema.safeParse(fields.taskCompletion);
      if (!parsedCompletion.success || Object.keys(fields).length !== 1) {
        return NextResponse.json(
          { error: "Task completion request is invalid" },
          { status: 400 }
        );
      }

      const project = await prisma.project.findFirst({ where: { id, ownerId: user.id } });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const parsedRoadmap = ProjectRoadmapSchema.safeParse(project.roadmap);
      if (!parsedRoadmap.success) {
        return NextResponse.json(
          { error: "Project roadmap was not found" },
          { status: 409 }
        );
      }

      const roadmap = normalizeRoadmapTaskProgress(parsedRoadmap.data);
      const { phaseIndex, taskIndex, completed } = parsedCompletion.data;
      if (
        phaseIndex >= roadmap.phases.length ||
        taskIndex >= (roadmap.phases[phaseIndex]?.tasks.length ?? 0)
      ) {
        return NextResponse.json(
          { error: "Project roadmap task was not found" },
          { status: 409 }
        );
      }

      const targetTaskIndex = roadmap.phases
        .slice(0, phaseIndex)
        .reduce((count, phase) => count + phase.tasks.length, 0) + taskIndex;
      const tasksBeforeTarget = roadmap.phases.flatMap((phase) =>
        phase.tasks.map((_, index) => isRoadmapTaskComplete(phase, index))
      ).slice(0, targetTaskIndex);
      if (completed && tasksBeforeTarget.some((taskComplete) => !taskComplete)) {
        return NextResponse.json(
          { error: "Complete the previous task before continuing." },
          { status: 409 }
        );
      }

      let currentTaskIndex = 0;
      const updatedRoadmap = normalizeRoadmapTaskProgress({
        ...roadmap,
        phases: roadmap.phases.map((phase) => {
          const taskCompletion = phase.tasks.map((_, currentIndex) => {
            const wasComplete = isRoadmapTaskComplete(phase, currentIndex);
            const nextComplete = currentTaskIndex < targetTaskIndex
              ? wasComplete
              : currentTaskIndex === targetTaskIndex
                ? completed
                : completed && wasComplete;
            currentTaskIndex += 1;
            return nextComplete;
          });

          return { ...phase, taskCompletion };
        }),
      });
      const result = await prisma.project.updateMany({
        where: { id, ownerId: user.id },
        data: { roadmap: updatedRoadmap },
      });

      if (result.count === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      return NextResponse.json({ roadmap: updatedRoadmap });
    }

    // Check that the project exists and belongs to this user
    const project = await prisma.project.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Start with an empty object.
    // Only fields provided in the request will be updated.
    const data: {
      name?: string;
      description?: string;
    } = {};

    // Validate and update name only if provided
    if (fields.name !== undefined) {
      if (
        typeof fields.name !== "string" ||
        !fields.name.trim()
      ) {
        return NextResponse.json(
          { error: "Name is invalid" },
          { status: 400 }
        );
      }

      data.name = fields.name.trim();
    }

    // Validate and update description only if provided
    if (fields.description !== undefined) {
      if (
        typeof fields.description !== "string" ||
        !fields.description.trim()
      ) {
        return NextResponse.json(
          { error: "Description is required" },
          { status: 400 }
        );
      }

      data.description = fields.description.trim();
    }

    // Make sure at least one field was provided
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400 }
      );
    }

    // Update only the project belonging to this user
    const result = await prisma.project.updateMany({
      where: {
        id,
        ownerId: user.id,
      },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Fetch the updated project
    const updatedProject = await prisma.project.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Failed to update project:", error);

    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {

    const project = await prisma.project.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    await prisma.project.deleteMany({
      where: {
        id,
        ownerId: user.id,
      },
    });

    return NextResponse.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Failed to delete project:", error);

    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
