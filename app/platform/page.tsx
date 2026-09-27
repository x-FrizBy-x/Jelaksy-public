import Link from "next/link";

export default function AppPlaceholder() {
  return (
    <main className="placeholder-page">
      <div className="placeholder-glow" aria-hidden="true" />
      <span className="eyebrow"><i /> Jelaksy workspace</span>
      <h1>Your space to build<br /><em>what's next.</em></h1>
      <p>The Jelaksy workspace is taking shape. Come back soon.</p>
      <Link className="button button-primary" href="/">Return home</Link>
    </main>
  );
}