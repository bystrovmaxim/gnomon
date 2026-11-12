// packages/maxitor/maxitor-core/web/app/w/[code]/core/settings/users/page.tsx
// Settings → Users (specs/072-maxitor-core/mockup 9.1–9.11), drawn by the core in the right panel. Only an
// organization's administrator sees it; for anyone else it is "No such page", as an address that does not exist.
import { NoSuchPage } from "@/components/frame/Panel";
import { UsersPage } from "@/components/UsersPage";
import type { User } from "@/app/users";
import { core, me, type Invitation } from "@/lib/core";

type Opened = { code: string; name: string; user: { name: string; is_admin: boolean } };

export default async function UsersSettingsPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { code } = await params;
  const query = await searchParams;
  const account = await me();
  const opened = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  const listing = opened.ok && opened.data.user.is_admin ? await core<{ users: User[]; invitations: Invitation[] }>("GET", `/api/v1/organizations/${encodeURIComponent(code)}/users`) : null;
  if (!account || !opened.ok || !listing?.ok) return <NoSuchPage code={code} />;
  const own = listing.data.users.find((u) => u.account_id === account.account_id && u.state !== "removed");
  return (
    <UsersPage
      code={opened.data.code}
      organization={opened.data.name}
      me={own?.id ?? ""}
      initial={listing.data}
      tab={query.tab === "invitations" ? "invitations" : "users"}
      open={query.user ?? null}
    />
  );
}
