# 9. Now and the past

**Builds on**: [8. The page](08-the-page.md). **Next**: chapter 10, written with bystrovmaxim/gnomon#100.

Every page reads at a moment. The address carries it as `at`; a page without `at` reads **now** — the watermark, the latest moment whose answer cannot change. The past, its time scale and comparing come with bystrovmaxim/gnomon#100; this chapter is the now.

## Now moves

When anyone in the organization writes, "now" moves, and Maxitor tells the open page with `panel.watermark`. A page at now reads again; the template marks a note it did not hold before as new:

<!-- quote: packages/maxitor-plugin-template/web/app/[org]/notes/parts.tsx -->
```tsx
  useWatermark(
    useCallback(() => {
      if (now) router.refresh();
    }, [now, router]),
  );
```

`router.refresh()` reads the server part again with the same address; the client keeps the ids it held, and `newSince` gives the ones that are new. A page with `at` never reads again: its answer cannot change.

## Check it

Open an item's Draft and, in another tab of the same person, write a note on the same item: within seconds it appears in the first tab without a reload. Then open Published notes in a second person's browser: nothing of the draft shows there until it is published, and a publication made in the meantime reaches the open pages at now and marks the changes it meets in the draft.
