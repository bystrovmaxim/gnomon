// web/app/[org]/items/[item_id]/published/page.tsx — the published notes of an item, opened at
// /w/<org>/notes/items/<item_id>/published: the revision in force at the panel's moment and its notes, read only.
import { momentFrom } from "@maxitor/panel";

import { read } from "../../../notes/server";
import type { Change } from "../../../notes/draft";
import type { PublishedNote, Revision } from "../../../notes/revision";
import { PublishedView } from "./PublishedView";

type Props = { params: Promise<{ org: string; item_id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function PublishedNotesPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const at = momentFrom(await searchParams) ?? undefined;
  const [published, draft] = await Promise.all([
    read<{ revision: Revision | null; notes: PublishedNote[] }>(org, `/items/${encodeURIComponent(item_id)}/published`, { at }),
    read<{ revision: Revision | null; changes: Change[] }>(org, `/items/${encodeURIComponent(item_id)}/draft`, { at }),
  ]);
  return (
    <PublishedView
      org={org}
      itemId={item_id}
      revision={published?.revision ?? null}
      notes={published?.notes ?? []}
      changes={draft?.changes ?? []}
    />
  );
}
