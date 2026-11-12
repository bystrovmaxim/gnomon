# Specification Quality Checklist: Maxitor core and the plugin template — the time scale

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- The specification names the parts of the contract a plugin writes against — the address parameters (`at`, `mode`, `from`, `written`, `changed`), the page's setup (`kinds`, `small`, `flag`, `compare`, `actions`), the components of `@maxitor/panel` and the graph viewer's parts it reuses — as this repository's specifications do: by principle I of the constitution they are the domain's terms, one name each, and the issue fixes them. No language, framework, database or code structure is chosen here; the plan does that.
- The visual values (the canvas's surface and dots, the halo, the fading) are stated because the maintainer accepted them on the mockups as taken from the graph viewer; they are acceptance values, not an implementation.
- The Clarifications record the decisions settled with the maintainer on the mockups on 2026-11-12; no question is left open.
