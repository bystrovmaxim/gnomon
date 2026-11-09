# UseCaseDiagramViewer


<p align="center">
  <a href="https://github.com/bystrovmaxim/gnomon"><img src="https://img.shields.io/badge/license-Apache_2.0-blue" alt="Apache-2.0"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="../../../../README.md"><img src="https://img.shields.io/badge/docs-Maxitor%20client-blue" alt="Maxitor client"></a>
</p>

**Role:** Graphviz **dot** rendering of a domain **UML-style use-case** diagram (`GET` via **`@/api/domainUseCaseDiagram`**): WASM layout to SVG, **pan/zoom** via **`useSvgPanZoom`**, dotted canvas, **Fit to window** in **`ZoomToolbar`**, optional **boundary** subgraph, **dot LR/TB** plus **Neato/FDP** presets, optional **single-hop filtering**, and **`postProcessGraphvizSvgDom`** from **`@/lib/sanitizeGraphvizSvgOverlays`** so backdrop and edge arrow fills do not hide the grid. In Diff it draws A and B together: each action, role and link marked, an action changed inside marked as changed, everything else faded; the counts go to the version button; a click opens the card, and the stepper walks the changes. The filter panel holds Domains and, in Diff, Changes, with the paint switch (spec 041).

Every page reads the use cases of all domains. A domain's page takes its scope from them — the domain's use cases and their roles — and its base: the scope with every use case of another domain one include, extend, depends or generalization away (a role is no way across: every domain's use cases share the guest). 1-hop on draws the base, off the scope; the panel lists the base either way, a row with nothing drawn dimmed. The page of all domains is its own base and has no 1-hop switch (spec 071).

On the page of all domains each domain is a boundary in its colour, titled with its disk and name. The button beside Boundary folds every boundary into one box — its disk, its name, how many use cases, in Diff how many changed: a role keeps one arrow to each box its use cases lie in and its generalizations, and the links between two boxes are one counted line. Folding needs boundaries: with Boundary off nothing is folded. Boundary, the fold and the layout make another picture, which fits again; the fold is a page setting, `boundaries_folded` in the address, and a room shares it.

## Public exports

**`index.ts`** exports **`UseCaseDiagramViewer`** and **`UseCaseDiagramViewerProps`**. DOT bundles are produced by **`@/lib/buildDomainUseCaseDotSource`**; domain narrowing uses **`@/lib/filterUseCaseDiagramByDomains`**; WASM prefetch uses **`@/lib/prefetch/erdGraphviz`**.

## Files

| File | Responsibility |
|------|----------------|
| `UseCaseDiagramViewer.tsx` | Fetch diagram JSON, legend and one-hop controls, rankdir/layout engine presets, DOT → SVG inject, viewport fit/center. |
