"use client";

import { useActionState } from "react";
import { resendVerification, type ResendState } from "../actions";

const initialState: ResendState = {};

export default function ResendForm({ email }: { email: string }) {
	const [state, formAction, pending] = useActionState(resendVerification, initialState);

	return (
		<form className="authorization-form" action={formAction}>
			<input type="hidden" name="email" value={email} />
			<p role="status" aria-live="polite" className="authorization-error">{state.message}</p>
			<button className="button button-primary authorization-submit" type="submit" disabled={pending || !email}>Resend email</button>
		</form>
	);
}
