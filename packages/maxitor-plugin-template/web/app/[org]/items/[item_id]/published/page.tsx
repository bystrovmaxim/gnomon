// web/app/[org]/items/[item_id]/published/page.tsx — the published notes of an item, opened at
// /w/<org>/notes/items/<item_id>/published: the revision in force at the panel's moment and its notes.
import { momentFrom } from "@maxitor/panel";

import { read } from "../../../notes/server";
import { PublishedView } from "./PublishedView";
import type { Revision } from "../../../notes/revision";
import type { Note } from "../../../notes/parts";

type Props = { params: Promise<{ org: string; item_id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function PublishedNotesPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const found = await read<{ revision: Revision | null; notes: Note[] }>(org, `/items/${encodeURIComponent(item_id)}/published`, { at: momentFrom(await searchParams) ?? undefined });
  return <PublishedView revision={found?.revision ?? null} notes={found?.notes ?? []} />;
}
