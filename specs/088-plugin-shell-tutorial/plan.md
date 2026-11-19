# Plan

Use the existing implementation and spec 087 as the contract. Update chapter 8 first, then reconcile the other tutorial chapters, index and compatibility page. Keep marked source excerpts exact; clearly label the optional client-component example so readers do not mistake it for the template's current bottom-bar selector.

Run the tutorial quotation tests and typecheck the extracted TSX example against the installed panel 0.8.0 types. Break one quoted API line and one example prop separately, confirm each validation fails for that defect, then restore. Check relative links and current navigation/versions against source. Record the audit and results before writing the documentation changelog.

One phase, one commit, branch `feature/issue-132-plugin-shell-tutorial`, one PR assigned to the maintainer. Only documentation and specs change, so no package version or graph export changes are needed. The pushed-commit browser receipt follows repository publication rules; CI decides its documentation-only jobs.

Analysis: the scope is existing behavior, not a new API. Source types, ownership and version requirements resolve the terminology; no critical finding or clarification remains. The constitution and submodule are unchanged.
