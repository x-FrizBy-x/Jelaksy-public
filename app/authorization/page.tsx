import Link from "next/link";
import Image from "next/image";
import PlanetMark from "@/components/objects";
import AuthForm from "./AuthForm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

const providers = [
	["GitHub", "/icons/github.svg"],
	["Google", "/icons/google.svg"],
] as const;

const errorMessages: Record<string, string> = {
	oauth_failed: "Sign-in with that provider failed. Please try again.",
	oauth_unavailable: "That sign-in method isn't available right now.",
	oauth_email_unverified: "Your provider account has no verified email address, so we can't sign you in with it.",
	verify_invalid: "That verification link is invalid or has expired. Log in to request a new one.",
};

type AuthorizationPageProps = {
	searchParams: Promise<{ mode?: string | string[]; error?: string | string[] }>;
};

export default async function AuthorizationPage({ searchParams }: AuthorizationPageProps) {
	const user = await getCurrentUser();

	if (user) {
  		redirect("/platform");
	}
	const params = await searchParams;
	const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
	const isRegistering = mode === "register";
	const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
	const pageError = errorCode ? errorMessages[errorCode] : undefined;

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

				{pageError && <p role="alert" className="authorization-error">{pageError}</p>}

				<div className="provider-list">
					{providers.map(([provider, icon]) => (
						<a className="provider-button" href={`/api/auth/oauth/${provider.toLowerCase()}`} key={provider}>
							<Image className="provider-mark" src={icon} alt="" width={20} height={20} />
							<span>{isRegistering ? "Sign up with" : "Continue with"} {provider}</span>
						</a>
					))}
				</div>

				<div className="authorization-divider"><span>or {isRegistering ? "register" : "continue"} with email</span></div>

				<AuthForm key={mode} isRegistering={isRegistering} />

				<p className="authorization-register">{isRegistering ? "Already have an account?" : "Don't have an account yet?"} <a href={isRegistering ? "/authorization" : "/authorization?mode=register"}>{isRegistering ? "Log in" : "Register"}</a></p>
			</section>
		</main>
	);
}
