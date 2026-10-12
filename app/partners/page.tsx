import SecondaryPage from '../secondary-page';

export default function Page() {
  return (
    <SecondaryPage
      title="Build with Jelaksy"
      eyebrow="Partners"
      description="We believe better tools come from working together."
    >
      <section className="partner-coming-soon" aria-labelledby="partner-status">
        <span className="partner-status">PARTNERSHIPS / COMING SOON</span>
        <h2 id="partner-status">Our partner program will be here soon.</h2>
        <p>
          We&apos;re making room for thoughtful collaborations that help more
          people turn their ideas into projects. Details will be shared here
          as the program takes shape.
        </p>
      </section>
    </SecondaryPage>
  );
}
