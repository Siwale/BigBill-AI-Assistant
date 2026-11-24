import { redirect } from "next/navigation";
import { getSession } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile.onboardingCompletedAt || !session.profile.displayName) redirect("/onboarding");
  redirect("/app");
}
