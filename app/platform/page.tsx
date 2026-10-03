import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {logoutUser} from "@/app/authorization/actions";

export default async function Platform() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/authorization");
  
  }

  return (
    <main className="placeholder-page">
      <div className="placeholder-glow" aria-hidden="true" />

      <span className="eyebrow">
        <i /> Jelaksy workspace
      </span>

      <h1>
        Your space to build
        <br />
        <em>what's next.</em>
      </h1>

      <p>
        The Jelaksy workspace is taking shape. Come back soon.
      </p>

      <p>
        Logged in as: <strong>{user.email}</strong>
      </p>

      <form action={logoutUser}>
        <button
          className="button button-primary"
          type="submit"
        >
          Log out
        </button>
      </form>
    </main>
  );
}