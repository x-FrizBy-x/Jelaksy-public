import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {logoutUser} from "@/app/authorization/actions";
import { prisma } from "@/lib/prisma";
import ProjectsDashboard from "./ProjectsDashboard";
import { ProjectRoadmapSchema } from "@/lib/project-planning";


export default async function Platform() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/authorization");
  }

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      roadmap: true,
    },
  });
  const latestProject = projects[0];
  const latestRoadmap = latestProject
    ? ProjectRoadmapSchema.safeParse(latestProject.roadmap)
    : null;
  const latestTask = latestProject
    ? {
        projectId: latestProject.id,
        projectName: latestProject.name,
        task: latestRoadmap?.success
          ? latestRoadmap.data.phases.flatMap((phase) => phase.tasks)[0] ?? null
          : null,
      }
    : null;

  return (
  <main className="placeholder-page workspace-layout">
    <div className="placeholder-glow" aria-hidden="true" />
    <ProjectsDashboard
      userName={user.name}
      logoutAction={logoutUser}
      latestTask={latestTask}
      initialProjects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt.toISOString(),
      }))}
    />
  </main>
);}