import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

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
    const body = await request.json();

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
      description?: string | null;
      status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";
    } = {};

    // Validate and update name only if provided
    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        return NextResponse.json(
          { error: "Name is invalid" },
          { status: 400 }
        );
      }

      data.name = body.name.trim();
    }

    // Validate and update description only if provided
    if (
      body.description !== undefined &&
      typeof body.description !== "string" &&
      body.description !== null
    ) {
      return NextResponse.json(
        { error: "Description is invalid" },
        { status: 400 }
      );
    }

    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    // Validate and update status only if provided
    if (body.status !== undefined) {
      const validStatuses = [
        "ACTIVE",
        "COMPLETED",
        "ARCHIVED",
      ];

      if (
        typeof body.status !== "string" ||
        !validStatuses.includes(body.status)
      ) {
        return NextResponse.json(
          { error: "Project status is invalid" },
          { status: 400 }
        );
      }

      data.status = body.status as
        | "ACTIVE"
        | "COMPLETED"
        | "ARCHIVED";
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

