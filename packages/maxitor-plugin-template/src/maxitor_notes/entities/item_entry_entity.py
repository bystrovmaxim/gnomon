# packages/maxitor-plugin-template/src/maxitor_notes/entities/item_entry_entity.py
"""ItemEntryCoreEntity — one item as an entry of the list node ``item`` in Maxitor's tree."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.domain import BaseCoreEntity
from aoa.action_machine.intents.entity import entity
from maxitor_notes.notes_domain import NotesDomain


@entity(description="An item, what notes are written on, as one entry of the tree's list of items", domain=NotesDomain)
class ItemEntryCoreEntity(BaseCoreEntity):
    """
    AI-CORE-BEGIN
    ROLE: One instance of the list node ``item``: Maxitor draws it as a node and puts ``key`` into the scope as ``item_id``.
    CONTRACT: ``key`` is the item's id; ``title`` its title at the panel's moment, plain text; ``icon`` the tree's icon.
    AI-CORE-END
    """

    key: str = Field(min_length=1, description="The item's id: the value of item_id beneath it")
    title: str = Field(min_length=1, max_length=200, description="The item's title at the panel's moment")
    icon: str = Field(min_length=1, description="The icon the tree draws beside the title")
