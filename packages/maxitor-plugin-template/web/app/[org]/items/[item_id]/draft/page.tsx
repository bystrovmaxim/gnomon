// web/app/[org]/items/[item_id]/draft/page.tsx — the draft of an item, opened at /w/<org>/notes/items/<item_id>/draft:
// what was added, changed or removed since the last revision, and publishing it.
import { momentFrom } from "@maxitor/panel";

import { read } from "../../../notes/server";
import { DraftView } from "./DraftView";
import type { Change, Revision } from "../../../notes/revision";

type Props = { params: Promise<{ org: string; item_id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function DraftPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const found = await read<{ revision: Revision | null; changes: Change[] }>(org, `/items/${encodeURIComponent(item_id)}/draft`, { at: momentFrom(await searchParams) ?? undefined });
  return <DraftView org={org} itemId={item_id} revision={found?.revision ?? null} changes={found?.changes ?? []} />;
}
