"use client";

import { useActionState } from "react";
import { registerUser, loginUser, type AuthState } from "./actions";

const initialState: AuthState = {};

export default function AuthForm({ isRegistering }: { isRegistering: boolean }) {
	const [state, formAction, pending] = useActionState(
		isRegistering ? registerUser : loginUser,
		initialState
	);

	return (
		<form className="authorization-form" action={formAction}>
			{isRegistering && <>
				<label htmlFor="name">Name</label>
				<input id="name" name="name" type="text" placeholder="Your name" autoComplete="name" defaultValue={state.values?.name} />
			</>}
			<label htmlFor="email">Email address</label>
			<input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" defaultValue={state.values?.email} />
			<label htmlFor="password">Password</label>
			<input id="password" name="password" type="password" placeholder={isRegistering ? "Create a password" : "Enter your password"} autoComplete={isRegistering ? "new-password" : "current-password"} />
			{isRegistering && <>
				<label htmlFor="confirm-password">Confirm password</label>
				<input id="confirm-password" name="confirm-password" type="password" placeholder="Confirm your password" autoComplete="new-password" />
			</>}
			<p role="alert" aria-live="polite" className="authorization-error">{state.error}</p>
			<button className="button button-primary authorization-submit" type="submit" disabled={pending}>{isRegistering ? "Create account" : "Log in"}</button>
		</form>
	);
}
