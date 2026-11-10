"""Every reading query of the plugin: one moment (or one stretch), the SDK's condition at every version table, the organization in every condition."""

import re

import pytest
from maxitor_notes.storage.notes_storage import NotesStorage

from tests.recording_database import recording_pool

ORG = "11111111-1111-1111-1111-111111111111"
ITEM = "22222222-2222-2222-2222-222222222222"
MOMENT = "2026-11-08T10:15:00.123456Z"
LATER = "2026-11-09T10:15:00.123456Z"

#: Every reading method of the storage, with a valid call. A new reading method joins this list.
READS = {
    "notes_of_item": lambda storage: storage.notes_of_item(ORG, ITEM, MOMENT, None),
    "note_authors": lambda storage: storage.note_authors(ORG, ITEM, MOMENT, 50, None),
    "revision_at": lambda storage: storage.revision_at(ORG, ITEM, MOMENT),
    "published_notes": lambda storage: storage.published_notes(ORG, ITEM, MOMENT),
    "draft": lambda storage: storage.draft(ORG, ITEM, MOMENT),
    "note_versions_between": lambda storage: storage.note_versions_between(ORG, ITEM, MOMENT, LATER, None),
    "milestones": lambda storage: storage.milestones(ORG, ITEM, MOMENT, LATER),
}

_VERSIONS = re.compile(r'(?:FROM|JOIN) (?:"?\w+"?\.)?"?(\w+_versions)"? (\w+)')
_PARAMETER = r"\$\d{1,2}::text::timestamptz"


def problems_of(query: str) -> list[str]:
    """Every version table of ``query`` without the SDK's moment or stretch condition, or without the organization."""
    found = []
    for table, alias in _VERSIONS.findall(query):
        at_moment = re.search(rf"{alias}\.valid_from_at <= ({_PARAMETER}) AND \({alias}\.valid_to_at IS NULL OR {alias}\.valid_to_at > \1\)", query)
        over_stretch = re.search(rf"{alias}\.valid_from_at <= {_PARAMETER} AND \({alias}\.valid_to_at IS NULL OR {alias}\.valid_to_at > {_PARAMETER}\)", query)
        if not (at_moment or over_stretch):
            found.append(f"{table} {alias}: no moment condition")
        if f"{alias}.organization_id" not in query:
            found.append(f"{table} {alias}: no organization")
    return found


def _answer(query, params):
    if "watermark($1::text::uuid)" in query:
        return LATER
    if "FROM revision_versions r" in query:
        revision = {"number": 1, "ref": "v1", "title": "T", "comment": "C", "release": None, "publisher_id": ORG, "publisher_name": "", "at": MOMENT}
        return revision if "LIMIT 1" in query else [revision]
    if "FROM note_versions n" in query and "closed_by" not in query and "DISTINCT" not in query and "AS valid_from," not in query and params[2] == MOMENT:
        return [{"id": "gone", "item_id": ITEM, "writer_id": ORG, "writer_name": "", "body": "B", "updated_at": MOMENT, "since": MOMENT, "changed_by": ""}]
    return None


@pytest.mark.parametrize("read", sorted(READS))
async def test_every_reading_query_carries_the_moment_condition_and_the_organization(read) -> None:
    pool, connection = recording_pool(_answer)
    storage = NotesStorage(pool=pool)
    await storage.open()
    await READS[read](storage)
    reading = [query for query in connection.queries() if "_versions" in query and "max(valid_" not in query]
    assert reading, "the method read no version table"
    for query in reading:
        assert problems_of(query) == [], query


def test_a_query_without_the_condition_or_the_organization_is_caught() -> None:
    assert problems_of("SELECT n.body FROM note_versions n WHERE n.organization_id = $1::text::uuid") == ["note_versions n: no moment condition"]
    assert problems_of(
        "SELECT n.body FROM note_versions n WHERE n.valid_from_at <= $3::text::timestamptz"
        " AND (n.valid_to_at IS NULL OR n.valid_to_at > $3::text::timestamptz)"
    ) == ["note_versions n: no organization"]
