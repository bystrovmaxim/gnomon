# Feature Specification: The constitution and Maxitor follow the logical data model

**Feature Branch**: `feature/issue-60-logical-data-model`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #60, "Logical data model 4/4". Protocol 1.8 (#59) states the rules; AOA keeps them (bystrovmaxim/aoa#479) and its demo follows them (bystrovmaxim/aoa#480).

## What this is

The data model is logical: a relation knows no store, and every stored entity names its store. The constitution says so, and Maxitor reads the graphs AOA now writes.

## Clarifications

### Session 2026-11-06

- Q: How is the constitution changed? → A: Rules 24, 25 and 26 are amended in place, so no rule number moves: rule 24 says a relation is allowed between any two entities and promises no foreign key, join or transaction; rule 25 says a domain reaches a data source through one resource; rule 26 says a resource that stores an entity names its data source, connection parameters and the pool live only in a data source, and the connection policy is the data source's. Version 1.4.0, at the maintainer's instruction.
- Q: What does Maxitor check? → A: No rule: every rule is AOA's. Maxitor reads protocol 1.8 since #59; its own graph is 1.8 once `external/aoa` is at the merge commit of bystrovmaxim/aoa#480.
- Q: The ERD? → A: A relation line may now leave a data source contour. "No data source" stays for graphs of 1.6–1.7; a graph of 1.8 has none.

## Requirements

- **FR-001**: The constitution's rules 24, 25 and 26 follow the logical data model; version 1.4.0.
- **FR-002**: `external/aoa` moves to the merge commit of bystrovmaxim/aoa#480, with `uv.lock`, in a commit of its own; Maxitor's own graph and its tests build under AOA's new rules.
- **FR-003**: A browser check on the AOA demo graph: the ERD of all domains has a relation line that crosses a data source contour, and hovering a resource contour lights it.
- **FR-004**: The documentation drops "a relation line never crosses a data source contour" and says when "No data source" appears.
- **FR-005**: Every changed level raises its version; changelog.

## Success Criteria

- **SC-001**: The closing check run on the pull request is green, the browser checks included.
- **SC-002**: The browser check finds the chargeback's line from the billing warehouse to the shop database's order.
