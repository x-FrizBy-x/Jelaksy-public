import SecondaryPage from '../secondary-page';

export default function About() {
  return (
    <SecondaryPage
      title="About Jelaksy"
      eyebrow="The idea"
      description="A calmer, clearer way to move from a first thought to a finished project."
    >
      <section aria-labelledby="about-purpose">
        <h2 id="about-purpose">Good ideas deserve a clear next step.</h2>
        <p>
          Starting a project can feel like facing a blank page. Jelaksy helps
          turn the idea in your head into a roadmap you can actually work
          through, one phase at a time.
        </p>
      </section>
      <div className="secondary-card-grid">
        <article className="secondary-card">
          <span>01 / Start with context</span>
          <h3>Describe the idea</h3>
          <p>
            Give your project a name and description so the roadmap starts from
            what you want to build.
          </p>
        </article>
        <article className="secondary-card">
          <span>02 / Shape the path</span>
          <h3>Build a roadmap</h3>
          <p>
            Work with the planning assistant to explore the idea and organize
            it into focused phases and actionable tasks.
          </p>
        </article>
        <article className="secondary-card">
          <span>03 / Keep moving</span>
          <h3>Track your progress</h3>
          <p>
            Mark phases complete as you go and return to your saved roadmap
            whenever you need a reminder of what comes next.
          </p>
        </article>
      </div>
    </SecondaryPage>
  );
}
