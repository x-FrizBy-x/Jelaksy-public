import { z } from "zod";

export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 1000;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_STORED_CHAT_MESSAGES = 20;

const ProjectRoadmapPhaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(z.string()),
  taskCompletion: z.array(z.boolean()).optional(),
  completed: z.boolean().optional(),
});

const GeneratedProjectRoadmapSchema = z.object({
  title: z.string(),
  summary: z.string(),
  phases: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      tasks: z.array(z.string()),
    })
  ),
});

export const ProjectRoadmapSchema = z.object({
  title: z.string(),
  summary: z.string(),
  phases: z.array(ProjectRoadmapPhaseSchema),
});

export const ProjectChatResponseSchema = z.object({
  reply: z.string(),
  roadmap: GeneratedProjectRoadmapSchema,
});

export const ProjectChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export type ProjectRoadmap = z.infer<typeof ProjectRoadmapSchema>;
export type ProjectChatMessage = z.infer<typeof ProjectChatMessageSchema>;

export function isRoadmapTaskComplete(
  phase: ProjectRoadmap["phases"][number],
  taskIndex: number
) {
  return phase.taskCompletion?.[taskIndex] ?? phase.completed ?? false;
}

export function isRoadmapPhaseComplete(
  phase: ProjectRoadmap["phases"][number]
) {
  return phase.tasks.length > 0 && phase.tasks.every((_, taskIndex) =>
    isRoadmapTaskComplete(phase, taskIndex)
  );
}

export function normalizeRoadmapTaskProgress(
  roadmap: ProjectRoadmap
): ProjectRoadmap {
  let previousTasksComplete = true;

  return {
    ...roadmap,
    phases: roadmap.phases.map((phase) => {
      const taskCompletion = phase.tasks.map((_, taskIndex) => {
        const complete =
          previousTasksComplete && isRoadmapTaskComplete(phase, taskIndex);
        previousTasksComplete = complete;
        return complete;
      });

      const normalizedPhase = {
        ...phase,
        taskCompletion,
      };

      return { ...normalizedPhase, completed: isRoadmapPhaseComplete(normalizedPhase) };
    }),
  };
}
