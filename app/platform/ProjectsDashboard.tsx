"use client";

import { useState } from "react";
import styles from "./ProjectsDashboard.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlanetMark from "@/components/objects";

type Project = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
};

type View = "overview" | "projects" | "deadlines";
type LatestTask = {
  projectId: string;
  projectName: string;
  task: string | null;
} | null;

export default function ProjectsDashboard({
  userName,
  logoutAction,
  latestTask,
  initialProjects,
}: {
  userName: string;
  logoutAction: () => Promise<void>;
  latestTask: LatestTask;
  initialProjects: Project[];
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function loadProjects() {
    try {
      setError("");

      const response = await fetch("/api/projects");

      if (!response.ok) {
        throw new Error("Could not load projects");
      }

      const data: Project[] = await response.json();
      setProjects(data);
    } catch (error) {
      console.error(error);
      setError("We couldn't load your projects. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const sortedProjects = [...projects].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  const canCreateProject =
    view === "overview" ||
    view === "projects";

  const displayedProjects = view === "deadlines" ? [] : sortedProjects;

  async function createProject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFormError("");

    if (!newName.trim() || !newDescription.trim()) {
      setFormError("Please enter a project name and description.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not create the project."
        );
      }

      setProjects((current) => [data, ...current]);
      setNewName("");
      setNewDescription("");
      setCreating(false);
      router.push(`/platform/projects/${data.id}`);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  const pageTitle = view === "projects" ? "All projects." : "Your deadlines.";

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <Link href="/platform" className="brand" aria-label="Jelaksy home">
          <PlanetMark />
          <span>Jelaksy</span>
        </Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>WORKSPACE</p>

            <button
              className={`${styles.navItem} ${
                view === "overview" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setView("overview");
              }}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m3.5 10 8.5-7 8.5 7v10.5h-6v-7h-5v7h-6V10Z" />
              </svg>
              Overview
            </button>

            <button
              className={`${styles.navItem} ${
                view === "projects" ? styles.navItemActive : ""
              }`}
              onClick={() => {
                setView("projects");
              }}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 4.5h16v15H4zM8 8h8M8 12h8M8 16h5" />
              </svg>
              Projects
            </button>

            <button
              className={`${styles.navItem} ${
                view === "deadlines" ? styles.navItemActive : ""
              }`}
              onClick={() => setView("deadlines")}
            >
              <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 3.5v4m10-4v4M4 9h16M5 5.5h14a1 1 0 0 1 1 1v13H4v-13a1 1 0 0 1 1-1Z" />
                <path d="m8.5 14 2 2 5-5" />
              </svg>
              Deadlines
            </button>

          </div>
          <div className={styles.sidebarBottom}>
            <details className={styles.userMenu}>
              <summary className={styles.userMenuTrigger}>
                <span className={styles.avatar} aria-hidden="true">
                </span>
                <span className={styles.userMenuIdentity}>
                  <strong>{userName || "Your account"}</strong>
                  <small>Account options</small>
                </span>
              </summary>
              <div className={styles.userMenuPanel}>
                <button
                  className={styles.userMenuItem}
                  onClick={() => setSettingsOpen(true)}
                >
                  <span>⚙</span> Settings
                </button>
                <Link className={styles.userMenuItem} href="/pricing">
                  <span className={styles.planIcon} aria-hidden="true" /> Your plan
                </Link>
                <form action={logoutAction} className={styles.logoutForm}>
                  <button className={`${styles.userMenuItem} ${styles.logoutItem}`} type="submit">
                    <span>↪</span> Log out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </aside>

        <main className={styles.content}>
          {view === "overview" ? (
            <div className={styles.overview}>
              <div className={styles.overviewWelcome}>
                <h1 className={styles.heading}>Welcome back, {userName}</h1>
              </div>

              {loading ? (
                <div className={styles.message}>
                  <span className={styles.spinner} />
                  <p>Preparing your workspace...</p>
                </div>
              ) : error ? (
                <div className={styles.message} role="alert">
                  <p>{error}</p>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => {
                      setLoading(true);
                      loadProjects();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : projects.length === 0 ? (
                <section className={styles.firstProject}>
                  <p className={styles.eyebrow}>A FRESH START</p>
                  <h2>Create your first project with Jelaksy.</h2>
                  <p>Bring your idea. Jelaksy will help turn it into a clear roadmap and actionable tasks.</p>
                  <button
                    className={`${styles.createButton} ${styles.largeCreateButton}`}
                    onClick={() => {
                      setFormError("");
                      setCreating(true);
                    }}
                  >
                    <span>+</span>
                    <span>New project</span>
                  </button>
                </section>
              ) : (
                <section className={styles.latestTask}>
                  <p className={styles.eyebrow}>
                    {latestTask?.task ? "YOUR NEXT TASK" : "LATEST PROJECT"}
                  </p>
                  <h2>{latestTask?.projectName ?? projects[0].name}</h2>
                  <p className={styles.taskDescription}>
                    {latestTask?.task ??
                      "Your roadmap is ready to take shape. Open this project to map out your next steps with Jelaksy."}
                  </p>
                  <Link
                    className={styles.taskLink}
                    href={`/platform/projects/${latestTask?.projectId ?? projects[0].id}`}
                  >
                    {latestTask?.task ? "Get to the task" : "Open latest project"}
                    <span aria-hidden="true">→</span>
                  </Link>
                </section>
              )}
            </div>
          ) : (
            <>
          <div className={styles.welcome}>
            <h1 className={styles.heading}>
              {pageTitle}
            </h1>
          </div>

          <section className={styles.projectsSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>
                  {view === "deadlines" ? "Upcoming deadlines" : "All projects"}
                </h2>
              </div>

              {canCreateProject && (
                <button
                    className={styles.createButton}
                    onClick={() => {
                    setFormError("");
                    setCreating(true);
                }}
                >
                    <span>+</span>
                    <span>New project</span>
                </button>
                )}
                </div>

            {loading ? (
              <div className={styles.message}>
                <span className={styles.spinner} />
                <p>Preparing your workspace...</p>
              </div>
            ) : error ? (
              <div className={styles.message} role="alert">
                <p>{error}</p>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setLoading(true);
                    loadProjects();
                  }}
                >
                  Try again
                </button>
              </div>
            ) : displayedProjects.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptySymbol} aria-hidden="true" />
                <h3>
                  {view === "deadlines"
                    ? "Nothing due just yet."
                    : "A fresh start."}
                </h3>
                <p>
                  {view === "deadlines"
                    ? "Deadlines from your project roadmaps will appear here."
                    : "Your ideas deserve a place to grow. Create your first project and get started."}
                </p>
                {canCreateProject && (
                  <button
                    className={styles.createButton}
                    onClick={() => {
                      setFormError("");
                      setCreating(true);
                    }}
                  >
                    <span>+</span> Create a project
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.projectGrid}>
                {displayedProjects.map((project) => (
                  <article className={styles.projectCard} key={project.id}>
                    <div className={styles.cardTop}>
                      <span className={styles.projectGlyph} aria-hidden="true" />
                    </div>

                    <Link href={`/platform/projects/${project.id}`} className={styles.projectCardLink}>
                      <h3>{project.name}</h3>
                      <p className={styles.projectDescription}>
                        {project.description ||
                          "A new idea, ready to take shape."}
                      </p>

                      <div className={styles.cardFooter}>
                        <span>
                          {new Date(
                            project.createdAt
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}

              </div>
            )}
          </section>
            </>
          )}
        </main>
      </div>

      {creating && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setCreating(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
          >
            <button
              className={styles.modalClose}
              onClick={() => setCreating(false)}
              disabled={saving}
              aria-label="Close"
            >
              ×
            </button>

            <p className={styles.eyebrow}>NEW BEGINNING</p>
            <h2 id="create-project-title">Create a project.</h2>
            <p className={styles.modalDescription}>
              Give your next idea a name. You can figure out the rest as you go.
            </p>

            <form
              className={styles.createForm}
              onSubmit={createProject}
            >
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="e.g. My next big idea"
                maxLength={100}
                required
                autoFocus
              />

              <label htmlFor="project-description">
                Description
              </label>
              <textarea
                id="project-description"
                value={newDescription}
                onChange={(event) =>
                  setNewDescription(event.target.value)
                }
                placeholder="What's this project about?"
                rows={3}
                maxLength={1000}
                required
              />

              {formError && (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              )}

              <button
                className={styles.createButton}
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create project"}
              </button>
            </form>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className={styles.modalBackdrop}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <button
              className={styles.modalClose}
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
            >
              ×
            </button>
            <p className={styles.eyebrow}>YOUR PREFERENCES</p>
            <h2 id="settings-title">Settings.</h2>
            <p className={styles.modalDescription}>
              Workspace settings will live here. We can add profile,
              appearance, and notification options later.
            </p>
            <button
              className={styles.secondaryButton}
              onClick={() => setSettingsOpen(false)}
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
