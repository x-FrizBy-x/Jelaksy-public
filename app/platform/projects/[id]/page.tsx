import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ProjectChatMessageSchema,
  ProjectRoadmapSchema,
} from "@/lib/project-planning";
import ProjectChat from "./ProjectChat";
import styles from "./ProjectChat.module.css";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/authorization");
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!project) {
    notFound();
  }

  const roadmapResult = ProjectRoadmapSchema.safeParse(project.roadmap);
  const storedMessages = Array.isArray(project.chatMessages)
    ? project.chatMessages.flatMap((entry) => {
        const parsed = ProjectChatMessageSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

  return (
    <main className={styles.page}>
      <ProjectChat
        project={{
          id: project.id,
          name: project.name,
          description: project.description,
        }}
        initialRoadmap={roadmapResult.success ? roadmapResult.data : null}
        initialMessages={storedMessages}
      />
    </main>
  );
}
