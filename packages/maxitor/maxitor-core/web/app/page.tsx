// packages/maxitor/maxitor-core/web/app/page.tsx
// The sign-in page (mockup 1.1, 1.2, 1.10, 1.15, 1.16): email and password, and the providers the region allows.
import { redirect } from "next/navigation";

import { SignInCard } from "@/components/SignInCard";
import { me, ownPath, signInOptions } from "@/lib/core";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const next = ownPath(query.next);
  if (await me()) redirect(next ?? "/w");
  const options = await signInOptions();
  return <SignInCard options={options} next={next} error={query.error ?? null} />;
}
