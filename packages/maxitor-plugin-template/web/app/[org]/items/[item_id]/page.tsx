// web/app/[org]/items/[item_id]/page.tsx — the item's Draft, opened at /w/<org>/notes/items/<item_id>: the person's
// own changes over the published notes at the panel's moment. The published notes are read too, so Edit from
// Published can open here with the note as its base; nothing is written until the editor is saved.
import { momentFrom } from "@maxitor/panel";

import { read } from "../../notes/server";
import type { Change } from "../../notes/draft";
import type { PublishedNote, Revision } from "../../notes/revision";
import { DraftView } from "./DraftView";

type Props = { params: Promise<{ org: string; item_id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function DraftPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const query = await searchParams;
  const at = momentFrom(query) ?? undefined;
  // In Diff the core gives the other moment as _against: the draft then is read too (spec 079, FR-019).
  const against = query._against;
  const [draft, published, other] = await Promise.all([
    read<{ revision: Revision | null; changes: Change[] }>(org, `/items/${encodeURIComponent(item_id)}/draft`, { at }),
    read<{ revision: Revision | null; notes: PublishedNote[] }>(org, `/items/${encodeURIComponent(item_id)}/published`, { at }),
    against ? read<{ revision: Revision | null; changes: Change[] }>(org, `/items/${encodeURIComponent(item_id)}/draft`, { at: against }) : null,
  ]);
  return (
    <DraftView
      org={org}
      itemId={item_id}
      revision={draft?.revision ?? null}
      changes={draft?.changes ?? []}
      published={published?.notes ?? []}
      publishedRevision={published?.revision ?? null}
      other={against ? (other?.changes ?? []) : null}
    />
  );
}
