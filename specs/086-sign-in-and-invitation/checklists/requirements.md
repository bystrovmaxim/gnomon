# Specification Quality Checklist: sign-in and invitation

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

- The specification is held to the issue's phases: the invitation; who may invite; managing users; the last place; the closing check run; the documentation; the changelog. The mockup — screens 8–11 and M13–M15 of spec 072's mockup — is accepted before any code and is to be named by the issue as its first phase.
- The eleven resolutions in "Clarifications" are the reading this specification takes of points the issue leaves to the way: where an ordinary user invites from, where an administrator manages, how an invitation expires, that no letter goes about a withdrawal or an expiry, the new user's name, how a second letter counts, the rule of the last place, where an invitation is accepted; and, answered by the maintainer on 2026-11-12: a block, a removal or a change of the mark reaches a signed-in person from their next request; the last place is the page in the present, without the time scale's moment or comparison; `MAXITOR_INVITATION_DAYS` defaults to 14. The first eight are settled on the mockup; if the maintainer reads any of them another way, the specification follows the mockup, not the other way round.
- The rule of the last place is written here as the issue asks it to be written into the issue before its phase; the issue's wording wins when it differs.
- `MAXITOR_INVITATION_DAYS` and `no-reply@maxitor.aoa.run` are named because the issue names them: a setting of the core and the sender of every letter of Maxitor, not an implementation choice of this specification.
