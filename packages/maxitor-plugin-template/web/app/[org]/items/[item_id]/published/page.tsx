// web/app/[org]/items/[item_id]/published/page.tsx — the published notes of an item, opened at
// /w/<org>/notes/items/<item_id>/published: the revision in force at the panel's moment and its notes, read only; in a comparison the notes at the other moment too.
import { momentFrom } from "@maxitor/panel";

import { read } from "../../../notes/server";
import type { Change } from "../../../notes/draft";
import type { PublishedNote, Revision } from "../../../notes/revision";
import { PublishedView } from "./PublishedView";

type Props = { params: Promise<{ org: string; item_id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function PublishedNotesPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const query = await searchParams;
  const at = momentFrom(query) ?? undefined;
  // In a comparison the core gives the other moment as _against: the notes then are read too (spec 079, FR-019).
  const against = query._against;
  // The filters of dates are read on the server, so the page and its bars choose the same notes (spec 079, FR-046).
  const filters = { written: query.written, changed: query.changed };
  const path = `/items/${encodeURIComponent(item_id)}`;
  const [published, draft, other] = await Promise.all([
    read<{ revision: Revision | null; notes: PublishedNote[] }>(org, `${path}/published`, { at, ...filters }),
    read<{ revision: Revision | null; changes: Change[] }>(org, `${path}/draft`, { at }),
    against ? read<{ revision: Revision | null; notes: PublishedNote[] }>(org, `${path}/published`, { at: against, ...filters }) : null,
  ]);
  return (
    <PublishedView
      org={org}
      itemId={item_id}
      revision={published?.revision ?? null}
      notes={published?.notes ?? []}
      changes={draft?.changes ?? []}
      other={against ? (other?.notes ?? []) : null}
    />
  );
}
