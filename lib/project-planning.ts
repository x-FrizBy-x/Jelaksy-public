import { z } from "zod";

const ProjectRoadmapPhaseSchema = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(z.string()),
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
