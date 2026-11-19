// packages/maxitor/maxitor-core/web/app/w/[code]/core/settings/plugins/page.tsx
// Settings → Plugins (specs/073-plugin-marketplace/mockup 1.1–7.2), drawn by the core in the right panel. Only an
// organization's administrator sees it; for anyone else it is "No such page", as an address that does not exist.
import { AdministrationPanel } from "@/components/administration/AdministrationPanel";
import { readAdministration } from "@/components/administration/read";
import { NoSuchPage } from "@/components/frame/Panel";
import { PluginsPage } from "@/components/PluginsPage";
import type { Listing } from "@/app/plugins";
import { core } from "@/lib/core";

type Opened = { code: string; name: string; user: { is_admin: boolean } };

async function LivePluginsSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const opened = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  const listing = opened.ok && opened.data.user.is_admin ? await core<Listing>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/plugins?query=`) : null;
  if (!opened.ok || !listing?.ok) return <NoSuchPage code={code} />;
  return <PluginsPage code={opened.data.code} orgName={opened.data.name} initial={listing.data} />;
}

export default async function AdministrationRoute({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const section = "plugins";
  const snapshot = await readAdministration(code, section, query.at);
  if (!snapshot.ok) return <NoSuchPage code={code} />;
  const against = query._against ? await readAdministration(code, section, query._against) : null;
  if (against && !against.ok) return <NoSuchPage code={code} />;
  const historical = Boolean(query.at || query._against);
  return <AdministrationPanel section={section} snapshot={snapshot.data.rows} against={against?.ok ? against.data.rows : null}>
    {historical ? null : <LivePluginsSettingsPage params={params} />}
  </AdministrationPanel>;
}
