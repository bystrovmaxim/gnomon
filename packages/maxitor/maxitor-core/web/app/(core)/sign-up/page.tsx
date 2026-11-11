// packages/maxitor/maxitor-core/web/app/sign-up/page.tsx
// Creating an account by email (mockup 1.13, 1.14, then 1.3–1.7 for the code).
import { redirect } from "next/navigation";

import { SignUpFlow } from "@/components/SignUpFlow";
import { me } from "@/lib/core";

export default async function SignUpPage() {
  if (await me()) redirect("/w");
  return <SignUpFlow />;
}
