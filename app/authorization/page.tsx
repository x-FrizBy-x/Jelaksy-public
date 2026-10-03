import Link from "next/link";
import Image from "next/image";
import PlanetMark from "@/components/objects";
import { registerUser, loginUser } from "./actions";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

const providers = [
	["GitHub", "/icons/github.svg"],
	["Google", "/icons/google.svg"],
	["Apple", "/icons/apple.svg"],
] as const;

type AuthorizationPageProps = {
	searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function AuthorizationPage({ searchParams }: AuthorizationPageProps) {
	const user = await getCurrentUser();

	if (user) {
  		redirect("/platform");
	}
	const params = await searchParams;
	const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
	const isRegistering = mode === "register";
	const providerPrefix = isRegistering ? "mode=register&" : "";

	return (
		<main className="authorization-page">
			<div className="authorization-glow" aria-hidden="true" />
			<Link className="brand authorization-brand" href="/" aria-label="Jelaksy home">
				<PlanetMark />
				<span>Jelaksy</span>
			</Link>
			<Link className="authorization-home" href="/">Home</Link>

			<section className="authorization-panel" aria-labelledby="authorization-title">
				<span className="eyebrow"><i /> {isRegistering ? "Start your journey" : "Continue your journey"}</span>
				<h1 id="authorization-title">{isRegistering ? "Create your space" : "Welcome back."}</h1>
				<p className="authorization-intro">{isRegistering ? "" : "Log in to continue shaping what's next."}</p>

				<div className="provider-list">
					{providers.map(([provider, icon]) => (
						<a className="provider-button" href={`/authorization?${providerPrefix}provider=${provider.toLowerCase()}`} key={provider}>
							<Image className="provider-mark" src={icon} alt="" width={20} height={20} />
							<span>{isRegistering ? "Sign up with" : "Continue with"} {provider}</span>
						</a>
					))}
				</div>

				<div className="authorization-divider"><span>or {isRegistering ? "register" : "continue"} with email</span></div>

				<form className="authorization-form" action={isRegistering ? registerUser : loginUser}>
					{isRegistering && <>
						<label htmlFor="name">Name</label>
						<input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" />
					</>}
					<label htmlFor="email">Email address</label>
					<input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
					<label htmlFor="password">Password</label>
					<input id="password" name="password" type="password" placeholder={isRegistering ? "Create a password" : "Enter your password"} autoComplete={isRegistering ? "new-password" : "current-password"} />
					{isRegistering && <>
						<label htmlFor="confirm-password">Confirm password</label>
						<input id="confirm-password" name="confirm-password" type="password" placeholder="Confirm your password" autoComplete="new-password" />
					</>}
					<button className="button button-primary authorization-submit" type="submit">{isRegistering ? "Create account" : "Log in"}</button>
				</form>

				<p className="authorization-register">{isRegistering ? "Already have an account?" : "Don't have an account yet?"} <a href={isRegistering ? "/authorization" : "/authorization?mode=register"}>{isRegistering ? "Log in" : "Register"}</a></p>
			</section>
		</main>
	);
}
