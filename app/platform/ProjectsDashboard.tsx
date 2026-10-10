"use client";

import { useEffect, useState } from "react";
import styles from "./ProjectsDashboard.module.css";
import Link from "next/link";
import PlanetMark from "@/components/objects";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
};

type View = "overview" | "projects" | "statistics";
type StatusFilter = "ALL" | Project["status"];

export default function ProjectsDashboard({
  userName,
  logoutAction,
}: {
  userName: string;
  logoutAction: () => Promise<void>;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
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

  useEffect(() => {
    loadProjects();
  }, []);

  const sortedProjects = [...projects].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  const activeCount = projects.filter(
    (project) => project.status === "ACTIVE"
  ).length;

  const completedCount = projects.filter(
    (project) => project.status === "COMPLETED"
  ).length;

  const archivedCount = projects.filter(
    (project) => project.status === "ARCHIVED"
  ).length;

  const filteredProjects =
    filter === "ALL"
      ? sortedProjects
      : sortedProjects.filter(
          (project) => project.status === filter
        );
  const canCreateProject =
    view === "overview" ||
    (view === "projects" && filter === "ALL");

  const displayedProjects =
    view === "overview"
      ? filteredProjects.slice(0, 3)
      : filteredProjects;

  async function createProject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFormError("");

    if (!newName.trim()) {
      setFormError("Please enter a project name.");
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
          description: newDescription.trim() || null,
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
      setFilter("ALL");
      setView("projects");
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

  const pageTitle =
    view === "overview"
      ? "Your space to build."
      : view === "projects"
        ? filter === "ALL"
          ? "All projects."
          : filter === "ACTIVE"
            ? "Active projects."
            : filter === "COMPLETED"
              ? "Completed projects."
              : "Archived projects."
        : "Your progress.";

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <a
          href="/platform"
          className="brand"
          aria-label="Jelaksy home"
        >
          <span className={styles.brandMark}>
            <span />
          </span>
          <span>Jelaksy</span>
        </a>

        <div className={styles.topbarRight}>
          <div className={styles.avatar} aria-hidden="true">
            {userName.trim().charAt(0).toUpperCase() || "J"}
          </div>
        </div>
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
                setFilter("ALL");
              }}
            >
              <span className={styles.navIcon}>⌂</span>
              Overview
            </button>

            <button
              className={`${styles.navItem} ${
                view === "projects" && filter === "ALL"
                  ? styles.navItemActive
                  : ""
              }`}
              onClick={() => {
                setView("projects");
                setFilter("ALL");
              }}
            >
              <span className={styles.navIcon}>▤</span>
              Projects
              <span className={styles.navCount}>
                {projects.length}
              </span>
            </button>

            <button
              className={`${styles.navItem} ${
                view === "statistics" ? styles.navItemActive : ""
              }`}
              onClick={() => setView("statistics")}
            >
              <span className={styles.navIcon}>▥</span>
              Statistics
            </button>
          </div>
          <div className={styles.sidebarBottom}>
            <form action={logoutAction} className={styles.logoutForm}>
                <button className={styles.navItem} type="submit">
                    <span className={styles.navIcon}>↪</span>
                    Log out
                </button>
            </form>
            <button
              className={styles.navItem}
              onClick={() => setSettingsOpen(true)}
            >
              <span className={styles.navIcon}>⚙</span>
              Settings
            </button>
          </div>
        </aside>

        <main className={styles.content}>
          <div className={styles.welcome}>
            <p className={styles.eyebrow}>
              {view === "overview"
                ? "YOUR WORKSPACE"
                : view === "projects"
                  ? "YOUR COLLECTION"
                  : "WORKSPACE INSIGHTS"}
            </p>

            <h1 className={styles.heading}>
              {view === "overview" ? (
                <>
                  Your space to build
                  <br />
                  <em>what&apos;s next.</em>
                </>
              ) : (
                pageTitle
              )}
            </h1>

            <p className={styles.subtitle}>
              {view === "overview"
                ? `Welcome back${userName ? `, ${userName}` : ""}. Your next idea starts here.`
                : view === "projects"
                  ? "Everything you're working on, in one place."
                  : "A snapshot of everything you've been building."}
            </p>
          </div>

          {view === "statistics" && (
            <section className={styles.statsGrid}>
              <StatCard label="Active" count={activeCount} />
              <StatCard label="Completed" count={completedCount} />
              <StatCard label="Archived" count={archivedCount} />
            </section>
          )}

          <section className={styles.projectsSection}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>
                  {view === "overview"
                    ? "Recently created"
                    : view === "statistics"
                      ? "Your projects"
                      : "All projects"}
                </h2>
                <p>
                  {view === "overview"
                    ? "Pick up where your ideas are."
                    : "Every project has a place here."}
                </p>
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
                <div className={styles.emptySymbol}>✳</div>
                <h3>
                  {filter === "ALL"
                    ? "A fresh start."
                    : "Nothing here just yet."}
                </h3>
                <p>
                  {filter === "ALL"
                    ? "Your ideas deserve a place to grow. Create your first project and get started."
                    : "There are no projects in this category yet."}
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
                  <Link
                        href={`/platform/projects/${project.id}`}
              className={styles.projectCard}
              key={project.id}
            >
                    <div className={styles.cardTop}>
                      <span className={styles.projectGlyph}>
                        ✳
                      </span>
                      <span
                        className={`${styles.statusBadge} ${
                          project.status === "ACTIVE"
                            ? styles.activeBadge
                            : project.status === "COMPLETED"
                              ? styles.completedBadge
                              : styles.archivedBadge
                        }`}
                      >
                        {project.status === "ACTIVE"
                          ? "Active"
                          : project.status === "COMPLETED"
                            ? "Completed"
                            : "Archived"}
                      </span>
                    </div>

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
                      <span className={styles.cardArrow}>↗</span>
                    </div>
                  </Link>
                ))}

                {view === "overview" && sortedProjects.length > 3 && (
                  <button
                    className={styles.viewAllCard}
                    onClick={() => {
                      setView("projects");
                      setFilter("ALL");
                    }}
                  >
                    <span>View all projects</span>
                    <span>→</span>
                  </button>
                )}
              </div>
            )}
          </section>
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
                Description <span>(optional)</span>
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

function StatCard({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statNumber}>{count}</span>
      <span className={styles.statLabel}>{label} projects</span>
    </div>
  );
}
