"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isRoadmapPhaseComplete,
  isRoadmapTaskComplete,
  normalizeRoadmapTaskProgress,
  type ProjectChatMessage,
  type ProjectRoadmap,
} from "@/lib/project-planning";
import styles from "./ProjectChat.module.css";

type Project = {
  id: string;
  name: string;
  description: string;
};

export default function ProjectChat({
  project,
  initialRoadmap,
  initialMessages,
}: {
  project: Project;
  initialRoadmap: ProjectRoadmap | null;
  initialMessages: ProjectChatMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [roadmap, setRoadmap] = useState(
    initialRoadmap ? normalizeRoadmapTaskProgress(initialRoadmap) : initialRoadmap
  );
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState<string | null>(null);
  const [roadmapError, setRoadmapError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const autoPromptStarted = useRef(false);

  const sendMessage = useCallback(async (message: string) => {
    const content = message.trim();
    if (!content || sending) return;

    setSending(true);
    setPendingMessage(content);
    setError("");
    setInput("");

    try {
      const response = await fetch(`/api/projects/${project.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not reach the planning assistant.");
      }

      const updatedMessages: ProjectChatMessage[] = [
        ...messages,
        { role: "user", content },
        { role: "assistant", content: data.reply },
      ];
      setMessages(updatedMessages.slice(-20));
      setRoadmap(data.roadmap);
    } catch (requestError) {
      setPendingMessage(null);
      setInput(content);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach the planning assistant."
      );
    } finally {
      setPendingMessage(null);
      setSending(false);
    }
  }, [messages, project.id, sending]);

  async function updateTaskCompletion(
    phaseIndex: number,
    taskIndex: number,
    completed: boolean
  ) {
    if (!roadmap || updatingProgress !== null) return;

    const previousRoadmap = roadmap;
    const targetTaskIndex = roadmap.phases
      .slice(0, phaseIndex)
      .reduce((count, phase) => count + phase.tasks.length, 0) + taskIndex;
    let currentTaskIndex = 0;
    const updatedRoadmap = normalizeRoadmapTaskProgress({
      ...roadmap,
      phases: roadmap.phases.map((phase) => {
        const taskCompletion = phase.tasks.map((_, currentIndex) => {
          const taskComplete = isRoadmapTaskComplete(phase, currentIndex);
          const shouldComplete = currentTaskIndex < targetTaskIndex
            ? taskComplete
            : currentTaskIndex === targetTaskIndex
              ? completed
              : completed && taskComplete;
          currentTaskIndex += 1;
          return shouldComplete;
        });

        return { ...phase, taskCompletion };
      }),
    });

    setRoadmap(updatedRoadmap);
    setUpdatingProgress(`task-${phaseIndex}-${taskIndex}`);
    setRoadmapError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskCompletion: { phaseIndex, taskIndex, completed },
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update task completion.");
      }

      setRoadmap(data.roadmap);
    } catch (updateError) {
      console.error("Failed to update project task completion:", updateError);
      setRoadmap(previousRoadmap);
      setRoadmapError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update task completion. Please try again."
      );
    } finally {
      setUpdatingProgress(null);
    }
  }

  useEffect(() => {
    if (
      !autoPromptStarted.current &&
      project.description?.trim() &&
      !initialRoadmap &&
      initialMessages.length === 0
    ) {
      autoPromptStarted.current = true;
      void sendMessage(
        `Create a practical project roadmap based on this description: ${project.description.trim()}`
      );
    }
  }, [initialMessages, initialRoadmap, project.description, sendMessage]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  async function deleteProject() {
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete the project.");
      }

      router.replace("/platform");
      router.refresh();
    } catch (deleteError) {
      console.error(deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the project. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.projectHeading}>
        <div className={styles.projectTitle}>
          <p className={styles.eyebrow}>PROJECT WORKSPACE</p>
          <h1>{project.name}</h1>
        </div>
        <div className={styles.headingActions}>
          <Link href="/platform" className={styles.backLink}>← Back to projects</Link>
          <button
            className={styles.deleteButton}
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete project
          </button>
        </div>
      </section>

      <div className={styles.columns}>
        <section className={styles.chatPanel} aria-label="Project planning chat">
          <div className={styles.panelHeader}>
            <span className={styles.assistantMark} aria-hidden="true" />
            <div>
              <h2>Planning assistant</h2>
              <p>Explore the idea, then shape a roadmap together.</p>
            </div>
          </div>

          <div className={styles.conversation} aria-live="polite">
            {messages.length === 0 && pendingMessage === null ? (
              <div className={styles.welcomeMessage}>
                <span className={styles.welcomeGlyph} aria-hidden="true" />
                <h3>Let&apos;s make a roadmap.</h3>
                <p>
                  Tell me what success looks like, or start with a practical
                  first draft based on your project.
                </p>
                <button
                  className={styles.suggestion}
                  disabled={sending}
                  onClick={() =>
                    void sendMessage(
                      "Create a practical project roadmap for this idea with milestones and concrete tasks."
                    )
                  }
                >
                  Create a first-draft roadmap <span>→</span>
                </button>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <article
                    className={`${styles.message} ${
                      message.role === "user" ? styles.userMessage : styles.assistantMessage
                    }`}
                    key={`${index}-${message.role}`}
                  >
                    <span>{message.role === "user" ? "YOU" : "JELAKSY"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
                {pendingMessage !== null && (
                  <article className={`${styles.message} ${styles.userMessage}`}>
                    <span>YOU</span>
                    <p>{pendingMessage}</p>
                  </article>
                )}
              </>
            )}
            {sending && (
              <div className={styles.thinking} role="status">
                <i /><i /><i /> Building your roadmap
              </div>
            )}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
          <form className={styles.composer} onSubmit={handleSubmit}>
            <textarea
              aria-label="Message the planning assistant"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Share an idea, constraint, or next step..."
              maxLength={4000}
              rows={3}
              disabled={sending}
            />
            <div className={styles.composerFooter}>
              <span>Your roadmap updates as you work through the idea.</span>
              <button type="submit" disabled={sending || !input.trim()}>
                {sending ? "Thinking..." : "Send message"} <span>↗</span>
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.roadmapPanel} aria-label="Project roadmap">
          <div className={styles.panelHeader}>
            <span className={styles.roadmapIcon} aria-hidden="true" />
            <div>
              <h2>Your roadmap</h2>
              <p>{roadmap ? `${roadmap.phases.length} phases` : "Takes shape as you chat"}</p>
            </div>
          </div>

          {roadmap ? (
            <div className={styles.roadmapContent}>
              <p className={styles.roadmapKicker}>PROJECT ROADMAP</p>
              <h3>{roadmap.title}</h3>
              <p className={styles.roadmapSummary}>{roadmap.summary}</p>
              {roadmapError && <p className={styles.error} role="alert">{roadmapError}</p>}
              <ol className={styles.phaseList}>
                {roadmap.phases.map((phase, index) => (
                  <li
                    className={`${styles.phase} ${phase.completed ? styles.phaseCompleted : ""}`}
                    key={`${index}-${phase.title}`}
                  >
                    <span className={styles.phaseNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <div className={styles.phaseHeading}>
                        <h4>{phase.title}</h4>
                        <label className={styles.phaseCompletion}>
                          <input
                            type="checkbox"
                            checked={isRoadmapPhaseComplete(phase)}
                            disabled
                            aria-label={`Phase ${index + 1}: ${phase.title} completion status`}
                          />
                          <span>Complete</span>
                        </label>
                      </div>
                      <p>{phase.description}</p>
                      <ul className={styles.taskList}>
                        {phase.tasks.map((task, taskIndex) => {
                          const completed = isRoadmapTaskComplete(phase, taskIndex);
                          const previousTasksComplete = roadmap.phases
                            .slice(0, index)
                            .every((previousPhase) =>
                              previousPhase.tasks.every((_, previousTaskIndex) =>
                                isRoadmapTaskComplete(previousPhase, previousTaskIndex)
                              )
                            ) && phase.tasks
                              .slice(0, taskIndex)
                              .every((_, previousTaskIndex) =>
                                isRoadmapTaskComplete(phase, previousTaskIndex)
                              );
                          const disabled =
                            updatingProgress !== null ||
                            (!completed && !previousTasksComplete);

                          return (
                            <li
                              className={`${styles.taskItem} ${completed ? styles.taskCompleted : ""}`}
                              key={`${taskIndex}-${task}`}
                            >
                              <label className={styles.taskCompletion}>
                                <input
                                  type="checkbox"
                                  checked={completed}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    void updateTaskCompletion(
                                      index,
                                      taskIndex,
                                      event.target.checked
                                    )
                                  }
                                  aria-label={`Mark task ${taskIndex + 1} in phase ${index + 1}: ${task} as ${completed ? "incomplete" : "complete"}`}
                                />
                                <span>{task}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className={styles.roadmapEmpty}>
              <div className={styles.orbit} aria-hidden="true"><span /></div>
              <h3>Your roadmap starts here.</h3>
              <p>Start chatting to create phases and turn the idea into actionable steps.</p>
            </div>
          )}
        </aside>
      </div>
      {deleteDialogOpen && (
        <div
          className={styles.deleteDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteDialogOpen(false);
            }
          }}
        >
          <section
            className={styles.deleteDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
            aria-describedby="delete-project-description"
          >
            <p className={styles.eyebrow}>THIS CANNOT BE UNDONE</p>
            <h2 id="delete-project-title">Delete this project?</h2>
            <p id="delete-project-description">
              This will permanently delete <strong>{project.name}</strong>, including its roadmap and conversation.
            </p>
            {error && <p className={styles.deleteError} role="alert">{error}</p>}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.cancelDeleteButton}
                autoFocus
                disabled={deleting}
                onClick={() => setDeleteDialogOpen(false)}
              >
                Keep project
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                disabled={deleting}
                onClick={() => void deleteProject()}
              >
                {deleting ? "Deleting..." : "Yes, delete project"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
