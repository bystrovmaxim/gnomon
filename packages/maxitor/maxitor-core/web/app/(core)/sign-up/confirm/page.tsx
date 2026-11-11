// packages/maxitor/maxitor-core/web/app/sign-up/confirm/page.tsx
// The code step lives on /sign-up, which keeps the password for "send again"; this address leads there.
import { redirect } from "next/navigation";

export default function ConfirmPage() {
  redirect("/sign-up");
}
