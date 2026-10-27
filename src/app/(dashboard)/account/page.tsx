import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccountClient from "./account-client";

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const user = session.user as typeof session.user & { username?: string };
  return <AccountClient email={user.email} username={user.username ?? ""} />;
}
