// packages/maxitor/maxitor-core/web/app/(core)/w/[code]/core/panel-test/[[...path]]/page.tsx
// The panel's test page at /w/<code>/core/panel-test, for an organization's administrator only (spec 077, FR-029).
import { NoSuchPage } from "@/components/frame/Panel";
import { TestFrame } from "@/components/frame/TestFrame";
import { core } from "@/lib/core";

type Opened = { user: { is_admin: boolean } };

export default async function PanelTest({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const opened = await core<Opened>("GET", `/api/v1/organizations/${encodeURIComponent(code)}`);
  if (!opened.ok || !opened.data.user.is_admin) return <NoSuchPage code={code} />;
  return <TestFrame code={code} />;
}
