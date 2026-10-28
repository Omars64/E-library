import { DashboardApp } from "@/components/dashboard-app";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const { view } = await searchParams;
  return <DashboardApp initialView={view} />;
}
