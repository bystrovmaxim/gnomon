// web/app/[org]/items/[item_id]/page.tsx — the notes of one catalog item, opened at /w/<org>/notes/items/<item_id>.
// Everything the page shows comes from its address: the organization, the item, the view, the author filter and the moment.
import { headers } from "next/headers";
import { PanelPage, momentFrom } from "@maxitor/panel";
import { NotesView, type Note } from "./NotesView";

type Props = {
  params: Promise<{ org: string; item_id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ItemNotesPage({ params, searchParams }: Props) {
  const { org, item_id } = await params;
  const query = await searchParams;
  // Maxitor's gateway put a token for this plugin here; the page passes it on to its own backend and keeps nothing.
  const authorization = (await headers()).get("authorization") ?? "";

  const url = new URL(`${process.env.MAXITOR_PLUGIN_API}/${encodeURIComponent(org)}/items/${encodeURIComponent(item_id)}/notes`);
  // The moment stays an opaque string: it never passes through Date, which would cut it to milliseconds.
  const at = momentFrom(query);
  if (at) url.searchParams.set("at", at);
  if (query.author) url.searchParams.set("author", query.author);

  const response = await fetch(url, { headers: { authorization }, cache: "no-store" });
  const notes: Note[] = response.ok ? (await response.json()).notes : [];

  return (
    <PanelPage title="Notes">
      <NotesView notes={notes} />
    </PanelPage>
  );
}
