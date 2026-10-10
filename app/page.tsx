import Link from "next/link";
import {navItems} from "@/components/constants";
import PlanetMark, {ArrowIcon} from "@/components/objects";


function Brand() {
	return (
		<a className="brand" href="#top" aria-label="Jelaksy home">
			<PlanetMark />
			<span>Jelaksy</span>
		</a>
	);
}


function WorkspacePreview() {
	return (
		<div className="preview-shell" aria-label="Abstract preview of the Jelaksy workspace">
			<div className="preview-topbar">
				<div className="preview-dots"><span /><span /><span /></div>
				<div className="preview-address">jelaksy / your next idea</div>
				<div className="preview-status"><i /> private space</div>
			</div>
			<div className="preview-body">
				<aside className="preview-sidebar">
					<div className="mini-brand"><PlanetMark /><span>Jelaksy</span></div>
					<div className="sidebar-line active" />
					<div className="sidebar-line" />
					<div className="sidebar-line short" />
					<div className="sidebar-spacer" />
					<div className="sidebar-line short" />
				</aside>
				<div className="preview-content">
					<span className="preview-kicker">A new direction</span>
					<h3>Build something<br /><em>that matters.</em></h3>
					<p>Your ideas, gathered into a clear path forward.</p>
					<div className="preview-plan">
						<div className="plan-heading"><span>01</span><strong>Shape the idea</strong><b>+</b></div>
						<div className="plan-bar wide" /><div className="plan-bar" />
					</div>
					<div className="preview-plan faded">
						<div className="plan-heading"><span>02</span><strong>Make a plan</strong><b>+</b></div>
						<div className="plan-bar" />
					</div>
				</div>
				<div className="preview-orbit"><span /><span /><span /></div>
			</div>
		</div>
	);
}

export default function Home() {
	return (
		<main id="top" className="site-shell">
			<div className="space-field" aria-hidden="true"><span className="star-layer one" /><span className="star-layer two" /><span className="nebula nebula-one" /><span className="nebula nebula-two" /></div>
			<header className="site-header">
				<Brand />
				<nav className="main-nav" aria-label="Main navigation">
					{navItems.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
				</nav>
				<div className="header-actions"><a className="login-link" href="/authorization">Log in</a><a className="button button-small" href="/authorization?mode=register">Get Started <ArrowIcon /></a></div>
			</header>

			<section className="hero">
				<div className="hero-orbit orbit-large" aria-hidden="true" /><div className="hero-orbit orbit-small" aria-hidden="true" />
				<div className="hero-copy">
					<span className="eyebrow"><i /> The space to build what's next</span>
					<h1>Explore the future<br /><span>with Jelaksy</span></h1>
					<p>Jelaksy helps you turn an idea into a structured plan and guides you through building it step by step.</p>
					<a className="button button-primary" href="/authorization?mode=register">Get Started <ArrowIcon /></a>
				</div>
			</section>

			<section className="intro section-band" id="about">
				<div className="section-label"></div>
				<div className="intro-copy"><span className="eyebrow muted">A clearer way forward</span><h2>Turn your ideas<br /><em>into reality.</em></h2></div>
				<div className="intro-detail"><p>Jelaksy helps you turn an idea into a structured plan and guides you through building it step by step.</p><a className="button button-primary" href="/authorization">Start exploring <ArrowIcon /></a></div>
			</section>

			<section className="preview-section" aria-labelledby="preview-title">
				<div className="preview-heading"><span className="eyebrow muted">A glimpse of what's ahead</span><h2 id="preview-title">Give your next idea<br /><em>somewhere to go.</em></h2></div>
				<WorkspacePreview />
			</section>

			<section className="final-cta" id="contact-us">
				<div className="cta-stars" aria-hidden="true" />
				<div className="cta-copy">
					<span className="eyebrow">
						<i /> Your next chapter starts here
						</span><h2>Ready to<br /><em>explore?</em></h2>
						<Link className="button button-primary" href="/authorization?mode=register">Get Started <ArrowIcon /></Link>
						</div>
			</section>

			<footer className="site-footer" id="footer">
				<Brand /><div className="footer-links">{navItems.map(([label, href]) => <a href={href} key={href}>{label}</a>)}<a href="#footer">Privacy</a></div><span className="copyright">© 2026 Jelaksy</span>
			</footer>
		</main>
	);
}
