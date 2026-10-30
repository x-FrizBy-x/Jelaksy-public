import { describe, expect, it } from "vitest";
import {
  mergeGeneratedRoadmap,
  normalizeRoadmapTaskProgress,
  setTaskCompleted,
  type GeneratedProjectRoadmap,
  type ProjectRoadmap,
} from "@/lib/project-planning";

const roadmap = (phases: ProjectRoadmap["phases"]): ProjectRoadmap => ({
  title: "Plan",
  summary: "Summary",
  phases,
});

const twoPhases = (state: [boolean[], boolean[]]) =>
  roadmap([
    { title: "A", description: "", tasks: ["a1", "a2"], taskCompletion: state[0] },
    { title: "B", description: "", tasks: ["b1", "b2"], taskCompletion: state[1] },
  ]);

const completion = (r: ProjectRoadmap) => r.phases.map((p) => p.taskCompletion);

describe("normalizeRoadmapTaskProgress", () => {
  it("un-completes every task after an incomplete one", () => {
    const result = normalizeRoadmapTaskProgress(
      twoPhases([[true, false], [true, true]])
    );
    expect(completion(result)).toEqual([[true, false], [false, false]]);
  });

  it("derives phase completion from its tasks", () => {
    const result = normalizeRoadmapTaskProgress(
      twoPhases([[true, true], [true, false]])
    );
    expect(result.phases.map((p) => p.completed)).toEqual([true, false]);
  });

  it("falls back to legacy phase-level completed", () => {
    const result = normalizeRoadmapTaskProgress(
      roadmap([{ title: "A", description: "", tasks: ["a1", "a2"], completed: true }])
    );
    expect(completion(result)).toEqual([[true, true]]);
  });

  it("never marks an empty phase complete", () => {
    const result = normalizeRoadmapTaskProgress(
      roadmap([{ title: "A", description: "", tasks: [] }])
    );
    expect(result.phases[0].completed).toBe(false);
  });
});

describe("setTaskCompleted", () => {
  it("checks the next task in order", () => {
    const result = setTaskCompleted(twoPhases([[true, false], [false, false]]), 0, 1, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(completion(result.roadmap)).toEqual([[true, true], [false, false]]);
    }
  });

  it("refuses to check a task while an earlier one is incomplete", () => {
    const result = setTaskCompleted(twoPhases([[true, false], [false, false]]), 1, 0, true);
    expect(result).toEqual({ ok: false, reason: "blocked" });
  });

  it("unchecking also un-completes later tasks, across phases", () => {
    const result = setTaskCompleted(twoPhases([[true, true], [true, true]]), 0, 1, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(completion(result.roadmap)).toEqual([[true, false], [false, false]]);
    }
  });

  it("reports out-of-range indexes as not-found", () => {
    const r = twoPhases([[false, false], [false, false]]);
    expect(setTaskCompleted(r, 0, 5, true)).toEqual({ ok: false, reason: "not-found" });
    expect(setTaskCompleted(r, 9, 0, true)).toEqual({ ok: false, reason: "not-found" });
  });

  it("does not mutate its input", () => {
    const r = twoPhases([[false, false], [false, false]]);
    const snapshot = structuredClone(r);
    setTaskCompleted(r, 0, 0, true);
    expect(r).toEqual(snapshot);
  });
});

describe("mergeGeneratedRoadmap", () => {
  const saved = roadmap([
    {
      id: "p1",
      title: "Setup",
      description: "",
      tasks: ["Install tools", "Create repo"],
      taskIds: ["t1", "t2"],
      taskCompletion: [true, false],
    },
  ]);

  const generatedWith = (
    phases: GeneratedProjectRoadmap["phases"]
  ): GeneratedProjectRoadmap => ({ title: "Plan", summary: "S", phases });

  it("keeps progress for a reworded task matched by ID", () => {
    const merged = mergeGeneratedRoadmap(
      generatedWith([
        {
          id: "p1",
          title: "Setup (renamed)",
          description: "",
          tasks: [
            { id: "t1", text: "Install the toolchain" },
            { id: "t2", text: "Create repo" },
          ],
        },
      ]),
      saved
    );
    expect(merged.phases[0].id).toBe("p1");
    expect(merged.phases[0].taskIds).toEqual(["t1", "t2"]);
    expect(completion(merged)).toEqual([[true, false]]);
  });

  it("matches by exact text when the model returns null IDs", () => {
    const merged = mergeGeneratedRoadmap(
      generatedWith([
        {
          id: null,
          title: "Setup",
          description: "",
          tasks: [
            { id: null, text: "Install tools" },
            { id: null, text: "Create repo" },
          ],
        },
      ]),
      saved
    );
    expect(completion(merged)).toEqual([[true, false]]);
  });

  it("gives new items fresh IDs and no progress", () => {
    const merged = mergeGeneratedRoadmap(
      generatedWith([
        {
          id: null,
          title: "Brand new",
          description: "",
          tasks: [{ id: "bogus", text: "Something" }],
        },
      ]),
      saved
    );
    expect(merged.phases[0].id).not.toBe("p1");
    expect(merged.phases[0].taskIds?.[0]).toBeTruthy();
    expect(completion(merged)).toEqual([[false]]);
  });

  it("assigns distinct IDs when the model repeats an ID", () => {
    const merged = mergeGeneratedRoadmap(
      generatedWith([
        {
          id: "p1",
          title: "Setup",
          description: "",
          tasks: [
            { id: "t1", text: "Install tools" },
            { id: "t1", text: "Install tools again" },
          ],
        },
      ]),
      saved
    );
    const [a, b] = merged.phases[0].taskIds!;
    expect(a).not.toBe(b);
  });

  it("works with no existing roadmap", () => {
    const merged = mergeGeneratedRoadmap(
      generatedWith([
        { id: null, title: "A", description: "", tasks: [{ id: null, text: "x" }] },
      ]),
      null
    );
    expect(completion(merged)).toEqual([[false]]);
  });
});
