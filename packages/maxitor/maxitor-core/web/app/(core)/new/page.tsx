// packages/maxitor/maxitor-core/web/app/new/page.tsx
// Registering an organization (mockup 2.1–2.4).
import { redirect } from "next/navigation";

import { NewOrganization } from "@/components/NewOrganization";
import { me } from "@/lib/core";

export default async function NewPage() {
  const account = await me();
  if (!account) redirect("/?next=/new");
  return <NewOrganization email={account.email} />;
}
