import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PlanetMark from "@/components/objects";
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
      <header className={styles.header}>
        <Link href="/platform" className={styles.brand} aria-label="Back to Jelaksy workspace">
          <PlanetMark />
          <span>Jelaksy</span>
        </Link>
        <Link href="/platform" className={styles.backLink}>← All projects</Link>
      </header>
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
