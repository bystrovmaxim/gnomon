# Specification Quality Checklist: Maxitor core — the frame

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-11
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] 1. No implementation details (languages, frameworks, APIs)
- [x] 2. Focused on user value and business needs
- [x] 3. Written for non-technical stakeholders
- [x] 4. All mandatory sections completed

## Requirement Completeness

- [x] 5. No [NEEDS CLARIFICATION] markers remain
- [x] 6. Requirements are testable and unambiguous
- [x] 7. Success criteria are measurable
- [x] 8. Success criteria are technology-agnostic (no implementation details)
- [x] 9. All acceptance scenarios are defined
- [x] 10. Edge cases are identified
- [x] 11. Scope is clearly bounded
- [x] 12. Dependencies and assumptions identified

## Feature Readiness

- [x] 13. All functional requirements have clear acceptance criteria
- [x] 14. User scenarios cover primary flows
- [x] 15. Feature meets measurable outcomes defined in Success Criteria
- [x] 16. No implementation details leak into specification

## Notes

- Items 1 and 16: the specification names the files, messages and packages that are the core's contract with plugins (`navigation.yaml`, the panel messages, `@maxitor/panel`, `@maxitor/tokens`), as the plugin concept does; these are the product a plugin author uses, not a choice of implementation. How they are built is left to the plan.
- The open questions of the issue are decided in the specification's Clarifications, from the issue, the plugin concept and the order of bystrovmaxim/gnomon#72.
