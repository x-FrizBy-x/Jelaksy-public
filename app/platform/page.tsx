import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {logoutUser} from "@/app/authorization/actions";
import ProjectsDashboard from "./ProjectsDashboard";


export default async function Platform() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/authorization");
  }

  return (
  <main className="placeholder-page workspace-layout">
    <div className="placeholder-glow" aria-hidden="true" />
    <ProjectsDashboard
      userName={user.name}
      logoutAction={logoutUser}
    />
  </main>
);}