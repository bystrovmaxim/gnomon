# ElementCard

**Role:** The one card of Maxitor (spec 043): what an element is, its description, what changed in it in Diff, a table's fields, and a lifecycle's miniature. It opens on hover, or on a tap on a phone.

## Public exports

**`index.ts`** exports **`ElementCard`** and the types **`CardSubject`**, **`CardField`** and **`ElementCardProps`**.

## Files

| File | Responsibility |
|---|---|
| `ElementCard.tsx` | The card: what the diagram knows at once, the rest read when it opens. A relation's card names the relation by its field, says what it is (`Association · many to one`) and lists its two ends, From and To, each with the line's own mark for it (spec 071); a frame's rows read each table's description when they are pointed at. A long CamelCase name wraps between its words. |
| `src/lib/relationGlyphs.ts` | The marks of a relation's ends — the ERD's bars, circle and crow's foot — and of its kind, and the words for how many. |
| `src/lib/cardPlace.ts` | Where a card stands: beside what it describes, never over it — a card taller than the stage scrolls inside and stands beside all the same. |
| `LifecycleMiniature.tsx` | A lifecycle fitted into the card; a click opens the full diagram. |
| `src/lib/useHoverCard.ts` | When a card opens and closes: the rest, the stay. |
| `src/lib/lifecycleMiniature.ts` | Reading, drawing and keeping a miniature. |
