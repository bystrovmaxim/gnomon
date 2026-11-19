// packages/maxitor/maxitor-core/web/app/w/[code]/core/settings/organization/page.tsx
// Settings → Organization (specs/072-maxitor-core/mockup 10.1–10.3), drawn by the core in the right panel. Only an
// organization's administrator sees it; for anyone else it is "No such page", as an address that does not exist.
import { AdministrationPanel } from "@/components/administration/AdministrationPanel";
import { readAdministration } from "@/components/administration/read";
import { NoSuchPage } from "@/components/frame/Panel";
import { OrganizationPage } from "@/components/OrganizationPage";
import type { Settings } from "@/app/users";
import { core } from "@/lib/core";

async function LiveOrganizationSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const settings = await core<Settings>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/settings`);
  if (!settings.ok) return <NoSuchPage code={code} />;
  return <OrganizationPage code={code} initial={settings.data} />;
}

export default async function AdministrationRoute({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const section = "organization";
  const snapshot = await readAdministration(code, section, query.at);
  if (!snapshot.ok) return <NoSuchPage code={code} />;
  const against = query._against ? await readAdministration(code, section, query._against) : null;
  if (against && !against.ok) return <NoSuchPage code={code} />;
  const historical = Boolean(query.at || query._against);
  return <AdministrationPanel section={section} snapshot={snapshot.data.rows} against={against?.ok ? against.data.rows : null}>
    {historical ? null : <LiveOrganizationSettingsPage params={params} />}
  </AdministrationPanel>;
}
