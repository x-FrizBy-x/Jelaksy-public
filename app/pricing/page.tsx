"use client";

import Link from "next/link";
import {useState} from "react";
import {navItems} from "@/components/constants";
import PlanetMark, {ArrowIcon} from "@/components/objects";

	type Plan = {
		name: string;
		price: string;
		description: string;
		features: string[];
		featured?: boolean;
	};

	const plans: Record<"Personal" | "Business", Plan[]> = {
		Personal: [
			{
				name: "Basic",
				price: "$25",
				description: "A focused starting point for your next idea.",
				features: ["1 active project", "Core planning tools", "Unlimited notes"],
			},
			{
				name: "Pro",
				price: "$35",
				description: "More room to turn ambitious ideas into reality.",
				features: ["5 active projects", "Advanced project guidance", "Priority workspace access"],
				featured: true,
			},
			{
				name: "Ultra",
				price: "$50",
				description: "The complete toolkit for building without limits.",
				features: ["Unlimited projects", "Full planning toolkit", "Personalized insights"],
			},
		],
		Business: [
			{
				name: "Small",
				price: "$79",
				description: "A practical workspace for a growing team.",
				features: ["Up to 5 team members", "Shared project spaces", "Team planning tools"],
			},
			{
				name: "Medium",
				price: "$149",
				description: "A connected command center for active teams.",
				features: ["Up to 20 team members", "Advanced collaboration", "Workspace permissions"],
				featured: true,
			},
			{
				name: "Large",
				price: "$299",
				description: "Flexible structure for organizations at scale.",
				features: ["Unlimited team members", "Multiple workspaces", "Dedicated support"],
			},
		],
	};

	type PlanType = keyof typeof plans;

	export default function PricingPage() {
		const [planType, setPlanType] = useState<PlanType>("Personal");

		return (
			<main className="pricing-page">
				<div className="pricing-field" aria-hidden="true" />
				<header className="pricing-header">
					<Link className="brand" href="/" aria-label="Jelaksy home">
						<PlanetMark />
						<span>Jelaksy</span>
					</Link>
					<nav className="pricing-nav" aria-label="Pricing navigation">
						{navItems.map(([label, href]) => (
							<Link className={href === "/pricing" ? "pricing-nav-active" : undefined} href={href} key={href}>
								{label}
							</Link>
						))}
					</nav>
					<div className="header-actions pricing-actions">
						<Link className="login-link" href="/authorization">Log in</Link>
						<Link className="button button-small" href="/authorization">Get Started <ArrowIcon /></Link>
					</div>
				</header>

				<section className="pricing-content" aria-labelledby="pricing-title">
					<span className="eyebrow"><i /> Plans for your next chapter</span>
					<h1 id="pricing-title">Choose your <em>way</em></h1>
					<p className="pricing-intro">Start with the space you need today. Change plans as your ideas grow</p>

					<div className="plan-tabs" role="tablist" aria-label="Plan type">
						{(["Personal", "Business"] as const).map((type) => (
							<button
								className={`plan-tab ${planType === type ? "plan-tab-active" : ""}`}
								key={type}
								onClick={() => setPlanType(type)}
								role="tab"
								aria-selected={planType === type}
								type="button"
							>
								{type}
							</button>
						))}
					</div>

					<div className="plan-grid">
						{plans[planType].map((plan) => (
							<article className={`plan-card ${plan.featured ? "plan-card-featured" : ""}`} key={plan.name}>
								{plan.featured && <span className="plan-badge">Most popular</span>}
								<h2>{plan.name}</h2>
								<p className="plan-description">{plan.description}</p>
								<div className="plan-price"><strong>{plan.price}</strong><span>/ month</span></div>
								<ul>
									{plan.features.map((feature) => <li key={feature}>{feature}</li>)}
								</ul>
								<Link className={`button ${plan.featured ? "button-primary" : "button-outline"}`} href="/authorization">
									{plan.featured ? "Try out" : "Purchase"} <ArrowIcon />
								</Link>
							</article>
						))}
					</div>
				</section>
			</main>
		);
}
