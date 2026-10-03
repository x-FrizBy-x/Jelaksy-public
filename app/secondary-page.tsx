import Link from "next/link";
import {navItems} from "@/components/constants";
import PlanetMark, {ArrowIcon} from "@/components/objects";

export default function SecondaryPage({ 
  title, 
  eyebrow, 
  description
}:{ 
  title: string; 
  eyebrow: string; 
  description: string})
  {
  return <main className="placeholder-page">
    <div className="placeholder-glow" aria-hidden="true" />
    <header className="secondary-header">
      <Link className="brand" href="/"><PlanetMark /><span>Jelaksy</span></Link>
      <nav className="main-nav " aria-label="Navigation">
        {navItems.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
      <div className="header-actions secondary-actions">
        <Link className="login-link" href="/authorization">Log in</Link>
        <Link className="button button-small" href="/authorization?mode=register">Get Started <ArrowIcon /></Link>
      </div>
    </header>
    <span className="eyebrow"><i /> {eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
    <Link className="button button-primary" href="/">Return home <ArrowIcon /></Link>
  </main>;
}
