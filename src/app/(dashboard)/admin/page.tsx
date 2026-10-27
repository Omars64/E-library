import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const role = "role" in session.user ? String(session.user.role) : "user";
  if (!role.split(",").includes("admin")) redirect("/");
  return <AdminClient />;
}
