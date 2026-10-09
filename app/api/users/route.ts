import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await prisma.user.findMany();

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = await request.json();

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: body.password,
      name: body.name,
    },
  });

  return NextResponse.json(user, { status: 201 });
}