// packages/maxitor/maxitor-core/web/app/w/[code]/core/settings/users/page.tsx
// Settings → Users (specs/072-maxitor-core/mockup 9.1–9.11), drawn by the core in the right panel. Only an
// organization's administrator sees it; for anyone else it is "No such page", as an address that does not exist.
import { AdministrationPanel } from "@/components/administration/AdministrationPanel";
import { readAdministration } from "@/components/administration/read";
import { NoSuchPage } from "@/components/frame/Panel";
import { UsersPage } from "@/components/UsersPage";
import type { User } from "@/app/users";
import { core, me, type Invitation } from "@/lib/core";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean } };

async function LiveUsersSettingsPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const account = await me();
  const opened = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  const historical = Boolean(query.at || query._against);
  const listing = !historical && opened.ok && opened.data.user.is_admin ? await core<{ users: User[]; invitations: Invitation[] }>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/users`) : null;
  if (!account || !opened.ok || !opened.data.user.is_admin || (!historical && !listing?.ok)) return <NoSuchPage code={code} />;
  const own = (listing?.ok ? listing.data.users : []).find((u) => u.account_id === account.account_id);
  return (
    <UsersPage
      code={opened.data.code}
      organization={opened.data.name}
      me={own?.id ?? ""}
      initial={listing?.ok ? listing.data : { users: [], invitations: [] }}
      tab={query.tab === "history" ? "history" : query.tab === "invitations" ? "invitations" : "users"}
      open={query.user ?? null}
    />
  );
}

export default async function AdministrationRoute({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const section = (query.tab === "invitations" || query.tab === "history") ? "invitations" : "users";
  const snapshot = await readAdministration(code, section, query.at);
  if (!snapshot.ok) return <NoSuchPage code={code} />;
  const against = query._against ? await readAdministration(code, section, query._against) : null;
  if (against && !against.ok) return <NoSuchPage code={code} />;
  return <AdministrationPanel section={section} snapshot={snapshot.data.rows} against={against?.ok ? against.data.rows : null}>
    <LiveUsersSettingsPage params={params} searchParams={searchParams} />
  </AdministrationPanel>;
}
