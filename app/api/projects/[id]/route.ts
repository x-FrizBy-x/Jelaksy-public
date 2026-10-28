import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getOwnedProject, projectNotFound, requireUser } from "@/lib/api";
import {
  MAX_PROJECT_DESCRIPTION_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
} from "@/lib/project-planning";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  try {
    const project = await getOwnedProject(id, user.id);

    if (!project) {
      return projectNotFound();
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
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

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

    // Check that the project exists and belongs to this user
    const project = await getOwnedProject(id, user.id);

    if (!project) {
      return projectNotFound();
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

      if (fields.name.trim().length > MAX_PROJECT_NAME_LENGTH) {
        return NextResponse.json(
          { error: `Name must be ${MAX_PROJECT_NAME_LENGTH} characters or fewer` },
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

      if (fields.description.trim().length > MAX_PROJECT_DESCRIPTION_LENGTH) {
        return NextResponse.json(
          { error: `Description must be ${MAX_PROJECT_DESCRIPTION_LENGTH} characters or fewer` },
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
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  try {

    const project = await getOwnedProject(id, user.id);

    if (!project) {
      return projectNotFound();
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
