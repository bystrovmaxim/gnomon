// packages/maxitor/maxitor-core/web/app/w/[code]/core/settings/organization/page.tsx
// Settings → Organization (specs/072-maxitor-core/mockup 10.1–10.3), drawn by the core in the right panel. Only an
// organization's administrator sees it; for anyone else it is "No such page", as an address that does not exist.
import { NoSuchPage } from "@/components/frame/Panel";
import { OrganizationPage } from "@/components/OrganizationPage";
import type { Settings } from "@/app/users";
import { core } from "@/lib/core";

export default async function OrganizationSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const settings = await core<Settings>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/settings`);
  if (!settings.ok) return <NoSuchPage code={code} />;
  return <OrganizationPage code={code} initial={settings.data} />;
}
