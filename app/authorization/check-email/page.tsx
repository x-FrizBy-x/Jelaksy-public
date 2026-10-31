import Link from "next/link";
import { redirect } from "next/navigation";
import PlanetMark from "@/components/objects";
import { getCurrentUser } from "@/lib/session";
import ResendForm from "./ResendForm";

type CheckEmailPageProps = {
	searchParams: Promise<{ email?: string | string[] }>;
};

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
	if (await getCurrentUser()) {
		redirect("/platform");
	}

	const params = await searchParams;
	const email = (Array.isArray(params.email) ? params.email[0] : params.email) ?? "";

	return (
		<main className="authorization-page">
			<div className="authorization-glow" aria-hidden="true" />
			<Link className="brand authorization-brand" href="/" aria-label="Jelaksy home">
				<PlanetMark />
				<span>Jelaksy</span>
			</Link>
			<Link className="authorization-home" href="/">Home</Link>

			<section className="authorization-panel" aria-labelledby="check-email-title">
				<span className="eyebrow"><i /> One more step</span>
				<h1 id="check-email-title">Check your inbox</h1>
				<p className="authorization-intro">
					{email ? <>We sent a verification link to <strong>{email}</strong>. </> : "We sent you a verification link. "}
					Open it to finish signing in. The link expires in 24 hours.
				</p>

				<ResendForm email={email} />

				<p className="authorization-register"><Link href="/authorization">Back to log in</Link></p>
			</section>
		</main>
	);
}
