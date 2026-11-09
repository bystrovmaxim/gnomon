# Specification Quality Checklist: Maxitor core — signing in, registering an organization, the empty frame and one compatibility check for plugins

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-09
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

- The issue is technical by nature: the requirements name AOA's actions, gateways, domains and events, the cookie and the schemas because the issue and the constitution make them part of what is built (FR-002–FR-006, FR-016–FR-017, FR-035–FR-041). The user stories and the success criteria stay in the reader's terms; the technical names are kept in the requirements that must name them. Accepted as passing.
- The three questions were answered by the maintainer on 2026-11-10 and are in the spec's Clarifications: the session lives in a cookie (constitution 1.6.0 amends rule 55), email sign-in has a password checked against its hash (rule 56 as it stands; a provider's answer is checked by state and PKCE), and the mailbox is `privacy@aoa.run`. No marker remains.
