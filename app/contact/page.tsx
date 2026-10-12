import SecondaryPage from '../secondary-page';

export default function Page() {
  return (
    <SecondaryPage
      title="Let’s talk"
      eyebrow="Contact"
      description="Want to follow the project or get in touch? Find Jelaksy online."
    >
      <div className="contact-links" aria-label="Social links">
        <a
          className="contact-link-card"
          href="https://github.com/x-FrizBy-x"
          target="_blank"
          rel="noreferrer"
        >
          <span>CODE &amp; UPDATES</span>
          <strong>GitHub</strong>
          <small>Connect with me on GitHub</small>
        </a>
        <a
          className="contact-link-card"
          href="https://www.linkedin.com/in/oleksandr-gordieiev-swe17"
          target="_blank"
          rel="noreferrer"
        >
          <span>CONNECT</span>
          <strong>LinkedIn</strong>
          <small>Connect with me on LinkedIn</small>
        </a>
      </div>
      <p className="contact-note">
        These are profile-link placeholders. Update the URLs in{" "}
        <code>app/contact/page.tsx</code> before sharing the site.
      </p>
    </SecondaryPage>
  );
}
