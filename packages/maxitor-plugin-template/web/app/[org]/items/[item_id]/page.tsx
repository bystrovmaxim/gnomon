// web/app/[org]/items/[item_id]/page.tsx — the notes of one item, opened at /w/<org>/notes/items/<item_id>.
// Everything the page shows comes from its address: the organization, the item, the view, the author filter and the moment.
// Its controls are its own: it gives the shell of @maxitor/panel the authors and the choice of a list or a table, and
// the shell draws them in the same places as every page of Maxitor and writes them into the address.
import { headers } from "next/headers";
import { PanelPage, momentFrom, type BarSection, type FilterSection } from "@maxitor/panel";
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

  // MAXITOR_PLUGIN_API is the backend's inner address; its routes live under /p/notes/api/<organization>, as the gateway's do.
  const url = new URL(`${process.env.MAXITOR_PLUGIN_API}/p/notes/api/${encodeURIComponent(org)}/items/${encodeURIComponent(item_id)}/notes`);
  // The moment stays an opaque string: it never passes through Date, which would cut it to milliseconds.
  const at = momentFrom(query);
  if (at) url.searchParams.set("at", at);
  // The authors the filter offers: the item's writers at the panel's moment, read by the page from its own action.
  const authorsUrl = new URL(`${process.env.MAXITOR_PLUGIN_API}/p/notes/api/${encodeURIComponent(org)}/lists/list_note_authors`);
  authorsUrl.searchParams.set("item_id", item_id);
  authorsUrl.searchParams.set("limit", "200");
  if (at) authorsUrl.searchParams.set("at", at);
  const authorsAnswer = await fetch(authorsUrl, { headers: { authorization }, cache: "no-store" });
  const authors: { key: string; title: string }[] = authorsAnswer.ok ? (await authorsAnswer.json()).entries : [];
  const filters: FilterSection[] = [{ title: "Author", param: "author", rows: authors.map((author) => ({ key: author.key, label: author.title })) }];
  const bar: BarSection[] = [
    { kind: "choice", param: "view", default: "list", options: [{ value: "list", title: "List", icon: "list" }, { value: "table", title: "Table", icon: "table" }] },
  ];

  // The author filter lists the writers switched on, or is absent when every writer is. One writer is asked of
  // the backend; several are kept from every writer's notes here.
  const writers = query.author?.split(",").filter(Boolean);
  if (writers?.length === 1) url.searchParams.set("author", writers[0]);

  const response = await fetch(url, { headers: { authorization }, cache: "no-store" });
  const all: Note[] = response.ok ? (await response.json()).notes : [];
  const notes = writers ? all.filter((note) => writers.includes(note.writer_id)) : all;

  return (
    <PanelPage title="Notes" filters={filters} bar={bar}>
      <NotesView notes={notes} />
    </PanelPage>
  );
}
