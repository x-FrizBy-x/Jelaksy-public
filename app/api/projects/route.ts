import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import {
  MAX_PROJECT_DESCRIPTION_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
} from "@/lib/project-planning";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const projects = await prisma.project.findMany({
    where: {
      ownerId: user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(projects);
}


export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body is invalid" },
        { status: 400 }
      );
    }

    const name = "name" in body && typeof body.name === "string"
      ? body.name.trim()
      : "";
    const description =
      "description" in body && typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Project description is required" },
        { status: 400 }
      );
    }

    if (name.length > MAX_PROJECT_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    if (description.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description must be ${MAX_PROJECT_DESCRIPTION_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        ownerId: user.id,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } 
  catch (error) {
    console.error("Failed to create project:", error);

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}