import { z } from "zod";

export const MAX_PROJECT_NAME_LENGTH = 100;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 1000;
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
export const MAX_STORED_CHAT_MESSAGES = 20;

const ProjectRoadmapPhaseSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  tasks: z.array(z.string()),
  taskIds: z.array(z.string()).optional(),
  taskCompletion: z.array(z.boolean()).optional(),
  completed: z.boolean().optional(),
});

const GeneratedProjectRoadmapSchema = z.object({
  title: z.string(),
  summary: z.string(),
  phases: z.array(
    z.object({
      id: z.string().nullable(),
      title: z.string(),
      description: z.string(),
      tasks: z.array(
        z.object({
          id: z.string().nullable(),
          text: z.string(),
        })
      ),
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

export type GeneratedProjectRoadmap = z.infer<typeof GeneratedProjectRoadmapSchema>;
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

export type SetTaskCompletedResult =
  | { ok: true; roadmap: ProjectRoadmap }
  | { ok: false; reason: "not-found" | "blocked" };

/**
 * Checks or unchecks one task. Tasks complete in order, so checking is refused
 * ("blocked") while an earlier task is incomplete, and unchecking also
 * un-completes every later task.
 */
export function setTaskCompleted(
  roadmap: ProjectRoadmap,
  phaseIndex: number,
  taskIndex: number,
  completed: boolean
): SetTaskCompletedResult {
  const normalized = normalizeRoadmapTaskProgress(roadmap);

  if (taskIndex >= (normalized.phases[phaseIndex]?.tasks.length ?? 0)) {
    return { ok: false, reason: "not-found" };
  }

  const earlierTasksComplete = normalized.phases.every((phase, p) =>
    p > phaseIndex ||
    phase.tasks.every((_, t) =>
      p === phaseIndex && t >= taskIndex ? true : isRoadmapTaskComplete(phase, t)
    )
  );
  if (completed && !earlierTasksComplete) {
    return { ok: false, reason: "blocked" };
  }

  return {
    ok: true,
    roadmap: normalizeRoadmapTaskProgress({
      ...normalized,
      phases: normalized.phases.map((phase, p) =>
        p === phaseIndex
          ? {
              ...phase,
              taskCompletion: phase.tasks.map((_, t) =>
                t === taskIndex ? completed : isRoadmapTaskComplete(phase, t)
              ),
            }
          : phase
      ),
    }),
  };
}

/**
 * Gives every phase and task a stable ID so progress survives rewording.
 * Roadmaps stored before IDs existed get deterministic positional IDs, so the
 * IDs shown to the model and the ones used when merging its answer agree.
 */
export function ensureRoadmapIds(roadmap: ProjectRoadmap): ProjectRoadmap {
  return {
    ...roadmap,
    phases: roadmap.phases.map((phase, p) => ({
      ...phase,
      id: phase.id ?? `legacy-phase-${p}`,
      taskIds: phase.tasks.map((_, t) => phase.taskIds?.[t] ?? `legacy-task-${p}-${t}`),
    })),
  };
}

/** Renders the saved roadmap for the model, with the IDs it must preserve. */
export function describeRoadmapForModel(roadmap: ProjectRoadmap) {
  return JSON.stringify({
    title: roadmap.title,
    summary: roadmap.summary,
    phases: roadmap.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      description: phase.description,
      tasks: phase.tasks.map((text, i) => ({ id: phase.taskIds?.[i], text })),
    })),
  });
}

/**
 * Turns a model-generated roadmap into a stored one, carrying over completion
 * state. Items match by ID first (the model is told to keep IDs for unchanged
 * items, even if reworded), then by exact title/text as a fallback. Unknown,
 * duplicate or missing IDs get fresh ones.
 */
export function mergeGeneratedRoadmap(
  generated: GeneratedProjectRoadmap,
  existing: ProjectRoadmap | null
): ProjectRoadmap {
  const saved = existing ? ensureRoadmapIds(existing) : null;
  const savedPhases = saved?.phases ?? [];

  const savedTasksById = new Map<string, { phaseId: string; index: number }>();
  for (const phase of savedPhases) {
    phase.taskIds?.forEach((taskId, index) =>
      savedTasksById.set(taskId, { phaseId: phase.id!, index })
    );
  }

  const usedPhaseIds = new Set<string>();
  const usedTaskIds = new Set<string>();

  const phases = generated.phases.map((phase) => {
    const savedPhase =
      savedPhases.find((p) => p.id === phase.id && !usedPhaseIds.has(p.id!)) ??
      savedPhases.find((p) => p.title === phase.title && !usedPhaseIds.has(p.id!));
    const phaseId = savedPhase?.id ?? crypto.randomUUID();
    usedPhaseIds.add(phaseId);

    const taskIds: string[] = [];
    const taskCompletion: boolean[] = [];

    for (const task of phase.tasks) {
      let match: { phase: (typeof savedPhases)[number]; index: number } | undefined;

      const byId = task.id ? savedTasksById.get(task.id) : undefined;
      if (byId && !usedTaskIds.has(task.id!)) {
        const owner = savedPhases.find((p) => p.id === byId.phaseId);
        if (owner) match = { phase: owner, index: byId.index };
      }
      if (!match && savedPhase) {
        const index = savedPhase.tasks.findIndex(
          (text, i) => text === task.text && !usedTaskIds.has(savedPhase.taskIds![i])
        );
        if (index >= 0) match = { phase: savedPhase, index };
      }

      const taskId = match ? match.phase.taskIds![match.index] : crypto.randomUUID();
      usedTaskIds.add(taskId);
      taskIds.push(taskId);
      taskCompletion.push(match ? isRoadmapTaskComplete(match.phase, match.index) : false);
    }

    return {
      id: phaseId,
      title: phase.title,
      description: phase.description,
      tasks: phase.tasks.map((task) => task.text),
      taskIds,
      taskCompletion,
    };
  });

  return normalizeRoadmapTaskProgress({
    title: generated.title,
    summary: generated.summary,
    phases,
  });
}
