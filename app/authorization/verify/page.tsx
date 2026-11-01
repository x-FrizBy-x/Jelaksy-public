import Link from "next/link";
import { redirect } from "next/navigation";
import PlanetMark from "@/components/objects";
import { getCurrentUser } from "@/lib/session";
import { confirmEmailVerification } from "../actions";

type VerifyPageProps = {
	searchParams: Promise<{ token?: string | string[] }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyPageProps) {
	if (await getCurrentUser()) {
		redirect("/platform");
	}

	const params = await searchParams;
	const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? "";

	if (!token) {
		redirect("/authorization?error=verify_invalid");
	}

	return (
		<main className="authorization-page">
			<div className="authorization-glow" aria-hidden="true" />
			<Link className="brand authorization-brand" href="/" aria-label="Jelaksy home">
				<PlanetMark />
				<span>Jelaksy</span>
			</Link>
			<Link className="authorization-home" href="/">Home</Link>

			<section className="authorization-panel" aria-labelledby="verify-title">
				<span className="eyebrow"><i /> Last step</span>
				<h1 id="verify-title">Confirm your email</h1>
				<p className="authorization-intro">Press the button to verify your address and sign in.</p>

				<form className="authorization-form" action={confirmEmailVerification}>
					<input type="hidden" name="token" value={token} />
					<button className="button button-primary authorization-submit" type="submit">Confirm email</button>
				</form>
			</section>
		</main>
	);
}
