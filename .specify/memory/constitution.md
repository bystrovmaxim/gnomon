<!-- Sync Impact Report
  Version change: 1.4.0 → 1.5.0 (MINOR: amended rules).
  Amended rules 13, 15, 24, 25, 26 and 53 in the schema rules and in Data
    model and resources: a resource is a database and names its entities; an
    entity names only its domain and may lie in several resources or in none;
    a resource has no domain; a relation may join entities of any resources;
    there is no data source and no rule of one resource per domain and data
    source; a pool is chosen by the application, outside the model; written
    for issue #66 within the change the maintainer set out in
    bystrovmaxim/aoa#488.

  Version 1.4.0: 1.3.0 → 1.4.0 (MINOR: amended rules).
  Amended rules 24, 25 and 26 in Data model and resources: the data model is
    logical — a relation is allowed between any two entities and promises no
    foreign key, join or transaction; a domain reaches a data source through
    one resource; a resource that stores an entity names its data source,
    connection parameters and the pool live only in a data source, and the
    connection policy is the data source's; written for issue #60 at the
    maintainer's instruction.

  Version 1.3.0: 1.2.0 → 1.3.0 (MINOR: amended rules).
  Amended rules 24, 26 and 53 in Data model and resources: resources of one
    database share one data source, a pool lives only in a data source, the
    resource keeps the transaction, relations stay inside one data source (or
    one resource without one); written for issue #52 within the data source
    chain the maintainer authorised.

  Version 1.2.0: 1.1.0 → 1.2.0 (MINOR: a new rule).
  Added rule 71 in Pull requests: the browser checks start right after every
    push, in parallel with CI, dictated by the maintainer.

  Version 1.1.0: 1.0.0 → 1.1.0 (MINOR: a new section with two new rules).
  Added section: Pull requests — rule 69 (the maintainer is the assignee of
    every pull request) and rule 70 (automatic CI fixing is always on), both
    dictated by the maintainer.
  Templates: none need an update; plan-template's Constitution Check reads the
    constitution at run time.

  Version 1.0.0: template (no version) → 1.0.0
  Source: the constitution of bystrovmaxim/gameoffer, version 9.2.0, taken whole
    at the maintainer's instruction and written in English.
  Differences from the source, all at the maintainer's instruction:
    - commit messages are in English (the source asks for Russian);
    - the constitution, specifications, documentation and descriptions in the
      schema and the model are in English; Russian drafts live beside the
      English pages as *.ru_draft.md and never enter a commit;
    - examples name abstract things instead of the source project's domain.
  Rules that describe what this repository does not have yet (the schema,
  the data model, resources, extension tables, JWT, ./update-graphs.sh) are
  kept: they apply as soon as that part appears.
-->

# Constitution of development on AOA

## Core Principles

### I. One term — one meaning — one name in the code

Every domain entity has exactly one term, one meaning and one English
`snake_case` name, under which it lives in tables, columns, files and classes.
A term named in the specification moves into the schema under the same name.

NOT ALLOWED: synonyms, "second names", different names for one entity,
renaming an entity along the way.

Check: the name of an entity in the specification matches the name of the
table, the column and the file.

The constitution holds no subject-matter terms and does not describe a
particular domain. The glossary of terms is kept in the specification; here
there are only the rules of work.

### II. The spec goes ahead of the code

Any change of the schema or of the rules of working with data starts with a
specification in `specs/` and goes the path specify → clarify → plan → tasks →
implement. The specification is the source of truth; the schema snapshot and
the code are its consequence. A change that is not in the specification is not
made — even if it is obvious and small.

NOT ALLOWED: editing the snapshot without a specification; code ahead of the
plan; "we will document it later". An outdated specification is corrected, not
ignored.

Check: every edit of the snapshot and every change of the rules belongs to a
feature in `specs/`.

### III. The database does not decide for us

The identifier is assigned by whoever writes the data: `id` arrives in the
`INSERT` ready, and the column has no `DEFAULT`. Therefore a row with a
reference is inserted at the same moment as its parent: the parent's
identifier is already known, and `RETURNING` is not needed. Deleting a parent
that has children is forbidden — there are no cascades. No field is left
without an explicit `NULL` / `NOT NULL` and without a description.

The point of the principle: everything the database could decide silently is
decided in the specification. There are no hidden decisions in the schema.

Check: the schema has no `DEFAULT` on identifiers, no `ON DELETE CASCADE`, no
columns without a description and without explicit nullability.

### IV. A decision is kept apart from an idea

The specification and the documentation clearly separate "accepted" from
"under discussion". A hypothesis is marked as an idea under discussion and is
not implemented until it is accepted. Open questions are gathered in a section
of unresolved items and do not dissolve into the text as statements.

NOT ALLOWED: passing an idea off as an accepted decision; removing the "under
discussion" mark without the decision itself.

Check: no statement of the specification presents an unverified mechanic as
decided.

### V. A mechanic is checked by measurement, not by opinion

Every specification has measurable success criteria: a metric and a way of
comparison. Disputed variants of a mechanic are checked by comparing groups,
not by choosing by eye. A specification for which no metric and no way of
checking can be named is not ready for implementation.

Check: the specification names a metric and the way it is compared.

## Technology frame and schema rules

Stack: Postgres is the target store of the schema. The current structure of
the database is described by full snapshots of entities; the snapshot is the
only source of structure, and the `revisions/` folders are a historical record
of earlier transitions. DDL is expressed with SQLAlchemy Core operations.
Postgres runs in Docker on the server and is not started locally: a change of
the snapshot is read through in review and checked by offline SQL generation,
and the database on the server is brought to the snapshot by direct commands.

1. **The schema is code.** `schema/` holds the current snapshot of the database
   structure; the snapshot describes only the final state and is the only
   source of structure. An existing database is brought to the snapshot by
   direct commands written out from it; the structure on the server MUST NOT be
   edited from memory or "by eye", bypassing the snapshot and the repository.
2. **Domains instead of a dump.** `schema/` is split into subfolders by domain.
   The root of `schema/` holds only the environment and the commands for
   working with the schema; no entity file lies in the root. There is one
   Postgres schema — `public`: domain folders organise files, not namespaces.
3. **One entity — one file.** A table or a view is described by its own file,
   which creates the entity from scratch in its current state. The same file
   holds indexes, FKs and the initial filling. The definition of each field
   MUST take exactly one physical line: the name, the type, the nullability,
   the description and the parameters of the field are given on that line.
   The fields of a view MUST also be described one per line. Line length is no
   reason to wrap one field over several lines. Creating the structure MUST
   consist of explicit direct commands with literal object names. Loops,
   comprehensions, generators, branches and helper logic for generating the
   structure MUST NOT be used in the entity snapshot files. Every index, FK,
   constraint and trigger is given by a separate command; initial rows are
   listed explicitly, not computed from another set. Reading a file MUST NOT
   require mentally running a build algorithm. The ban applies to generating
   the structure, not to the internal logic of SQL functions being created:
   their full body is kept in an explicit create command. The shared snapshot
   builder lives outside the entity files.
   Filling in the schema is allowed only for enumerations, reference lists and
   states — there the data is the meaning of the entity — and also for a
   **test set**: rows needed only by checks. A test set MAY lie in the file of
   its table if it is marked as a test set, added by one explicit insert in the
   filling step and removed by one delete command when real filling appears;
   the application MUST NOT depend on it. Business data the application needs
   does not go into `schema/`.
   Check: the test set is marked, is removed by one command, and the
   application works without it.
4. **The order is set once.** The order of creation is set by the snapshot
   builder: first all tables are created, then FKs and dependent objects,
   views last. So the target of a reference appears before the reference
   itself, and the order is not set by a hand-written list of domains. The same
   order is kept when an existing database is brought to the snapshot.
5. **Four kinds of tables.** A *core* table is the main entity around which a
   domain is built. An *enumeration* is a closed list of values that changes
   only by editing the snapshot. A *reference list* is a list filled with data
   and changed without editing the snapshot. A *state* table is a closed list
   of lifecycle states; any of the first three kinds can have a lifecycle, so
   states are a fourth kind, not a property of a core table. A state table
   follows the rules of an enumeration. The distinguishing sign: to add a
   value, an enumeration and a state table need an edit of the snapshot, a
   reference list does not. The kind of a table is a tool for decisions, not a
   property of the schema: it decides the choice of identifier, name and
   references and MUST NOT be stored either as a column or in the table
   description. A many-to-many link is stored as a separate link table, not as
   a field: a link table is a core table, its first field is `id` of type
   `uuid` without a default, with a reference to each side and a unique pair.
   A cell MUST hold one value: an array or a set of codes in a column breaks
   the normal form and MUST NOT be used for a link. An enumeration table is a
   storage projection of a dictionary: its values are declared by an
   `*EnumEntity`, not by a Python `Enum` (rule 21).
6. **Identifiers.** For a core table and a reference list the first field is
   `id` of type `uuid`. For an enumeration it is `code` of type `text`, for a
   state table it is `state` of type `text`. The table name is plural; an
   enumeration has the suffix `_codes` (`color_codes`), a state table has the
   suffix `_states` (`<entity>_states`). `id` has no `DEFAULT`; the author of
   the data writes the value. In the initial filling of the snapshot `id` is
   written as a literal: it is visible in the diff, is reused as a reference by
   neighbouring rows and prevents duplicates when the same row is extended
   later. In a link table `id` is a service field: the model does not count it
   as a field (rule 19). In an enumeration table `code` is the identifier of
   the projection row; the value itself is declared by the dictionary
   (rule 21). The `id` of a link container (`AssociationOne`,
   `AssociationMany`) is the identifier of the link and of the transport, not
   a replacement for `code`/`state`: the PK of the value stays `code` or
   `state`.
7. **References.** An FK to `id` is named `<table in singular>_id`, an FK to
   `code` — `<table in singular>_code`, an FK to `state` — `<table in
   singular>_state`: `color_codes` gives the column `color_code`,
   `<entity>_states` gives the column `<entity>_state`. A reference to the
   table itself is named `parent_code`: a name after the table name
   (`‹table›_code` in `‹tables›`) would read as "parent of the parent". A
   many-to-many link MUST NOT be expressed by a set field (`_ids`, `_codes`,
   `_states`) or an array: a link table is created for it (rule 5). There are
   no cascades: `ON DELETE NO ACTION`, `ON UPDATE NO ACTION`.
8. **Values of `code` and `state`.** Lower-case English words that carry the
   meaning; a compound value of several words joined by a hyphen is allowed
   (`self-development`). Abbreviations are not allowed. Names of tables,
   columns and files are `snake_case`, without hyphens. Values of enumerations
   and states are not deleted: an outdated value is marked, otherwise the
   history of references breaks. The mark is the column `is_obsolete` of type
   `boolean`, `NOT NULL`, without a default: a live value stores `false`, an
   outdated one `true`, and the value is set explicitly. Every enumeration and
   state table has the column — always, not only once the first outdated value
   appears: the schema is uniform, and whoever writes data does not have to
   remember where the column exists and where it does not. References to an
   outdated value stay valid, and new data need not use it.
9. **Descriptions are mandatory.** Every table, view, column and index has an
   English description; a reference column names its source. An edit of the
   snapshot without descriptions is not accepted. The same descriptions are
   required for entities, fields and links of the model (rule 31).
10. **`NULL` is a meaning, not a default.** Every column states `NULL` or
    `NOT NULL` explicitly. `NULL` is allowed only where an unknown value makes
    sense, and the description says what exactly `NULL` means.
11. **Service time fields and field order.** Every table MUST have a creation
    date field (`created_at`) and an update date field (`updated_at`). The
    creation date field is mandatory and always filled; its value is set by the
    author of the data — like `id`, the column has no `DEFAULT`. The update
    date field allows `NULL`: `NULL` means "the row was never updated", a
    filled value means "when the row last changed". The creation date field
    MUST NOT change when the row is updated, and rows created or changed by one
    operation MUST carry the same time value.
    Order in the table description: table identifier → references → own fields
    → creation date field → update date field. The identifier is `id`, and for
    an enumeration and a state table `code` and `state` (rule 6). In a model
    entity description `id` is the first field, the service time fields are the
    last, and the order of the middle is set by the author according to the
    domain: the model describes the domain, not the columns (rule 17).
    A file reads top to bottom as the description of an entity.
    Check: every snapshot table has both columns; the table identifier comes
    first, and the last two columns are the creation date field and the update
    date field in this order. A mismatch is caught by a check, not by the eye.
12. **Forward only.** There is no reverse transition: a rollback is a restore
    from a backup, not a reverse operation. Before a destructive change
    (`DROP COLUMN`, `DROP TABLE`) a backup is mandatory.
13. **Domain passport.** Each domain folder holds a `README.md` — the passport
    of the domain, not a retelling of its tables; the rule applies to the
    domains of `schema/`, and the folders of `datamodel/` and `resources/` have
    no passports (rule 15). The passport MUST contain: the purpose of the domain
    and why it exists; its boundaries — what belongs to it and what clearly does
    not; the list of tables with the kind of each and one line of meaning; the
    links — which domains it references and who references it; the order of
    application — which entities are created from the snapshot and in what
    order; who fills its data and from where; what the domain does not do.
    The passport MUST be understandable to a person who did not write the
    domain and MUST be updated in the same edit as the domain itself: an edit
    of the snapshot without an updated passport is not accepted.

14. **The snapshot is the only source of structure; revisions are history.**
    Table and view files MUST contain only the full description of the current
    entities. They MUST NOT contain operations that change an earlier state
    (`ALTER COLUMN`, `DROP`, renames), historical states or transition
    functions from an earlier version. Creating an FK as a separate step with
    `ALTER TABLE ADD CONSTRAINT` is allowed: it is part of creating the entity
    from scratch. A deleted entity disappears from the current snapshot; its
    earlier description is kept only in history.
    The `revisions/` folders MAY stay in the repository as a **historical
    record** of earlier transitions: new revisions MUST NOT be created, the
    chain MUST NOT be kept up to date and MUST NOT be required for changing the
    structure. The chain of revisions does not have to produce the current
    snapshot: the source of structure is the snapshot, not the chain.
    A change of structure MUST come with an updated snapshot, and the database
    on the server with being brought to it; a separate revision MUST NOT be
    required for this.
    Check: the SQL of the current snapshot creates the current structure and
    MUST NOT contain changes of an earlier state; no rule, no check and no task
    requires a revision for changing the structure.

## Workflow and checks

- The path of a change: specify → clarify → plan → tasks → implement. Before
  implementation the specification goes through `speckit-analyze`; findings of
  CRITICAL level are closed before code starts.
- The branch of a task is named after the issue number; merging into `main`
  goes through a pull request; commit messages are in English.
- A pull request MUST close its task: the PR description has a closing
  reference (`Closes #N`), and the issue is closed **by merging** the PR, not
  by hand. Closing by hand is allowed only when the work is cancelled or
  re-filed as another task — and then the issue says what exactly closed it.
  Check: every PR names the number of the issue it closes; an open issue
  without a PR has a reason (cancelled, re-filed, waiting for a decision).
- A decision that touches both terms and tables comes in one pull request: the
  term, the specification and the snapshot edit do not drift into separate
  edits.
- There is no local database, but this does not cancel checks: a change of the
  snapshot that cannot be run locally is read through in review and checked by
  offline SQL generation.
- Every package MUST have a changelog — a file with the same name in the root of
  the package. An entry MUST be compact and MUST name what a dependent system
  sees: a route, a field, an event, a column, a value, an environment key, a
  behaviour; internal rearrangements invisible from outside MUST NOT get into
  the changelog. Changes are grouped by their nature — added, changed, removed,
  breaking — and a breaking change MUST say what the dependent has to do. An
  entry is tied to the package version: a change of the contract MUST bump the
  version, and the top entry MUST name the package version. The entry heading
  MUST also name the date and time the entry appeared:
  `## <version> — <YYYY-MM-DD HH:MM>`; this date MUST be on every entry of the
  changelog, not only on the top one. An entry is added in the same edit as the
  change; the history of the changelog MUST NOT be rewritten — what is removed
  is marked, not erased. A package without code has no changelog.
  Check: an automatic check requires a changelog in every package with code,
  matches the top entry against the package version by its heading and rejects
  an entry that has no version or no date and time of the declared form; an
  edit of a package without an entry is not accepted in review.

## Data model and resources

15. **Layers beside the schema.** Beside `schema/` inside a package lie
    `datamodel/` — business entities — and `resources/` — access to the
    store. `datamodel/` is divided by the domains of `schema/`; `resources/`
    by database, since a resource has no domain (rule 25). Neither has
    passports: a domain passport describes tables, and the model and the
    resources do not describe tables.
16. **One file — one business entity.** Each business entity lives in its own
    file in the domain folder. A lifecycle is described in the file of the
    entity it belongs to — no separate file is created for it.

17. **The model is the domain.** `datamodel/` describes business entities, not
    tables: the name of the entity, its fields and links come from the domain,
    not from the columns. The match with the table is checked separately and
    MUST NOT be a reason to name a field after a column.
18. **A core table always has an entity.** Every core table MUST have a model
    entity.
19. **A pure link gets no entity.** An association table that has no fields of
    its own MUST NOT get an entity; the service `id` does not count as a field.
    Both sides of such a link look at each other many-to-many: each side
    declares a `Many` link with a mutual `Inverse` on the field of the other
    side. A link to a dictionary is not an association table: a closed
    dictionary has no back field. Such a link is declared
    `AssociationOne[D]` or `AssociationMany[D]` with `NoInverse()`.
20. **A link with its own fields is an entity.** If an association table
    carries fields of its own, the entity MUST exist, and the sides look at
    each other through it, not directly.
21. **A database enumeration is a closed AOA dictionary.** A closed list of
    codes (`*_codes`, `event_kinds`) MUST be declared by an `*EnumEntity` in
    the domain of its code table: all values are in the body of the type,
    declared by the `value(...)` factory from `aoa.action_machine.domain`; a
    value has `code`, `display_name` and `is_obsolete`. A model field MUST be
    typed by the dictionary; a Python `Enum` MUST NOT be used for a database
    enumeration. One value is `Annotated[AssociationOne[D], NoInverse()]`; a
    set is `Annotated[AssociationMany[D], NoInverse()]` when stored as a link
    table, not as an array column. A link entity for a dictionary MUST NOT be
    created. The code of a value MUST be read from the value — `value.code` (a
    proxy to `entity.code`) or explicitly `entity.code`, not from the
    container (`id`); for a set — `[item.code for item in value]` (iterating
    over the values), not `ids`. Prefer the proxy and iteration; `.entity` and
    `.entities` only when the object itself or the tuple is needed, not the PK.
    The code table stays a storage projection (rules 5, 6, 8, 40); an outdated
    value stays in the dictionary (rule 8). Adding a value requires an edit of
    the snapshot and a declaration in the dictionary.
22. **A state is a lifecycle, not an entity.** A state table MUST NOT get an
    entity: states and transitions are described by the lifecycle of the
    entity they belong to. The state keys MUST match the values of the state
    table; transitions are not described in the schema, and the author of the
    model derives them.

23. **Cardinality is derived and confirmed.** Every link MUST declare its
    cardinality — one-to-one, one-to-many, many-to-many — and whether it is
    mandatory. The author of the model derives them from the meaning and the
    schema and MUST confirm them at the clarify stage: the database does not
    tell the cardinality.
24. **A resource is a database and names its entities.** A resource is one
    physical boundary, reached by one connection per call; only an action
    glues the data of two resources. A resource MUST list the entities it
    keeps (`@entities(...)`), and those are the only entities it may return.
    An entity names its domain (`@entity(description, domain=...)`) and never
    its store: the model knows no store, the store knows the model. An entity
    MAY lie in several resources or in none, and the graph shows which. While
    it is unknown what to read, a resource is created as an empty stub —
    without read methods; a method appears when it is known what exactly has
    to be fetched. A relation is a fact of the logical model: it is allowed
    between any two entities, whatever their resources, and promises no
    foreign key, no join and no shared transaction; a relation that crosses
    two resources is glued by an action.
    Check: every entity a resource returns is listed in its `@entities`.
25. **A resource has no domain.** A resource MUST NOT declare a domain: its
    domains are the domains of its entities, and a resource that keeps none is
    reached through the actions that use it. It lies in the storage package.
    Writes are not bounded by domain: an action of any domain may write
    through any resource it uses.
    Check: no resource declares a domain.
26. **A resource is a manager; a nested call gets a wrapper.** A resource owns
    the connection and the transport. A resource MUST take its base from the
    framework and inherit it **directly**, without its own mixins and
    intermediate base classes: for working with the database the base is the
    **framework's specialised SQL resource** (`PostgresResource`), not a bare
    `BaseResource`; for other stores — their framework resource.
    A nested call MUST receive a **wrapper**, not the resource itself: the
    wrapper rejects opening a connection, beginning, committing and rolling
    back a transaction — only whoever opened the transaction manages it. The
    resource declares the wrapper itself and returns it from
    `get_wrapper_class()`: for a resource with the framework's transport this
    is the framework's ready wrapper, for a resource with its own meaningful
    methods it is its own wrapper, repeating those methods and forbidding the
    lifecycle. A wrapper is a resource too: with `@meta`, and its
    `get_wrapper_class()` returns itself, so that the guarantee holds at any
    depth of nesting. There MUST NOT be a shared mixin for the wrapper: it is
    declared in the resource itself, not moved into a shared class.
    **How a resource connects is the application's choice.** The model has no
    data source and no pool. A resource keeps the transaction — it opens,
    begins, commits and rolls back. A PostgreSQL resource takes exactly one of
    `pool=` — a connection from a `PostgresPool` — or `connection_params=` —
    a connection of its own per call; the application chooses when it is
    assembled: a pool in a service's lifespan, an own connection in a script,
    a substitute pool in a test. A pool is not in the graph.
    Check: no resource takes both `pool=` and `connection_params=`, or
    neither.
27. **A resource holds no rules.** A resource MUST NOT contain domain
    conditions — "if premium", "if the term has expired" — and MUST NOT compute
    or derive values: it returns what it fetched. Conditions about the fetching
    itself — "no rows found, return empty" — stay.
28. **Entities go out.** A resource method MUST return model entities, not
    rows, dicts or tuples: the meaning of the columns is known by the entity,
    not by whoever called the resource. A read method MUST read the store and
    assemble the entity itself — full or partial (rule 29); a raw driver row
    MUST NOT leave the resource.

29. **Partial loading instead of a class per field set.** An incomplete set of
    fields MUST be returned by partial loading of the entity, not by a separate
    class for each set: a class per set is a second description of the same
    thing, and it will drift from the first at the first edit. A full entity is
    assembled by `build`, a partial one by `Entity.partial(...)`. Accessing a
    field that was not loaded MUST fail, not return emptiness: "not loaded" and
    "no value" are different things.
30. **A link instead of a key, without a default in its place.** A linked thing
    MUST be returned as a link, not as a field with its key. Whether one thing
    or a list comes back is decided by the declaration of the link, not by the
    resource.

    A link field MUST NOT have a default value other than `None`. A default
    puts into the link slot an object that is not a container; Pydantic does
    not validate defaults, so a field declared as `AssociationOne[X]` ends up
    holding a description object — the value silently contradicts the
    annotation, and the failure comes later and somewhere else. The only
    allowed default is declared by the annotation itself: `X | None` together
    with `Field(default=None)`. A mandatory link is declared
    `Field(description=…)` without a default value.

    `Rel(...)` as a default is forbidden: it carries nothing that
    `Field(description=…)` does not, and it makes the link optional. The
    description of a link is given by `Field(description=…)` and MUST be
    non-empty.

    The rule applies to all link containers without exception:
    `AssociationOne`, `AssociationMany`, `CompositeOne`, `CompositeMany`,
    `AggregateOne`, `AggregateMany`, `Specialization`, `Generalization`. There
    is no separate form of declaration for `Specialization`/`Generalization`:
    the axis is declared by the same `Field(description=…)`; this is verified
    against the AOA code — the resolver gives the same field name, the same
    description and the same set of codes.

31. **Descriptions are mandatory in the model too.** An English description
    MUST be on the entity, on every field and on every link — as in the schema.
    A description explains the meaning, it does not repeat the name.
32. **A mismatch between the model and the snapshot is caught by a check.**
    There MUST be a check that compares model entities with the schema
    snapshot and fails naming the mismatch. Changing a table or a column
    without touching the model MUST turn the check red. Model checks MUST NOT
    require a database.

## Extension tables

An extension table means a head table and the tables chosen by the value of its
qualifier field: a generalisation relation, not a link. The role of a table is
a **second dimension** of classification, independent of the first (core,
enumeration, association, states): any table can be a head, an extension or
an ordinary table.

33. **A qualifier column carries the suffix `_kind`.** A column whose value
    chooses an extension table MUST be named with the suffix `_kind`. A head
    table MAY have several such columns — along different axes, and each axis
    is independent: its own dictionary, its own values, its own extension
    tables. The model MUST NOT have a separate scalar qualifier code field: the
    head field with this name is a `Specialization` container, and the
    dictionary names the axis as the second argument (rule 38). The field name
    comes from the source column; the model invents no fields.
34. **A role is read from the form, not from a description.** A head table is
    one that has a field with the suffix `_kind`. An extension is a table named
    `‹head table name in singular›_‹qualifier code›` with a unique foreign key
    `‹head table name in singular›_id`. Separate declarations for this MUST NOT
    be required: the form declares itself, and the check finds such tables by
    traversal.
35. **There is no head table without extensions.** Every non-obsolete qualifier
    code MUST name an existing extension table; every extension table MUST be
    named by at least one code of its qualifier. The names of extension tables
    MUST be unique across all axes of a head table.
36. **A shared field is lifted, not repeated.** If a field is present in all
    extensions of a head table, it MUST be declared in the head table. A field
    shared by only some of the extensions stays in their tables and is declared
    in each of those entities.
37. **An entity for the head and for each extension.** The head table and each
    extension table MUST have an entity of their own. Concrete extensions MUST
    NOT repeat the fields of the head entity: the shared fields are reached
    through the reference, not by inheritance.
38. **The head and the extensions are linked directly.** The head entity MUST
    have a specialisation field: a `Specialization[‹Extension› | …,
    ‹Dictionary›]` container with the list of extension types, the closed
    dictionary as the second argument and `Inverse(field_name=‹back field›)`.
    The head MUST NOT have a classifier field or a `Classifier` marker. Each
    extension MUST have a `Generalization[‹Head›]` field with its single
    declared value (`Classifier(variant=‹Dictionary›.‹VALUE›)`) and
    `Inverse(‹Head›, ‹specialisation field›)`. `Literal` MUST NOT be used for
    specialisation codes. There MUST NOT be an intermediate base entity of an
    axis: the head and the extensions look at each other directly.
39. **A code is declared once and covered from both sides.** The codes of an
    axis are declared once — in the dictionary (rule 21). Each extension names
    its declared value. The build checks coverage both ways: each dictionary
    value has an owning extension, each extension contributes exactly one
    value, and there are no extra values or alternatives.

40. **An enumeration is named after its column.** An enumeration table is named
    after its column in plural, and the column carries a suffix by the role of
    the field: an ordinary reference to an enumeration is `_code` (table
    `‹column without suffix›s`), a qualifier field of extensions is `_kind`
    (rule 33). By the column name the check tells an enumeration from an
    ordinary table, so the checks must not keep a separate list of suffixes:
    the sign is read from the form, like everything in rules 33–39. An
    enumeration table is a projection of a dictionary; the model declares an
    `*EnumEntity` (rule 21).

## Actions

41. **An action is a self-contained business operation.** Logic that has value
    outside one scenario MUST be made a separate action: it carries its own
    input parameters and result, is called from several places and changes
    independently. Logic that lives only inside one scenario MUST stay an
    aspect of that action.

42. **Input and output are frozen contracts.** The input parameters of an
    action MUST be an immutable typed model (`Params`), the result an immutable
    model (`Result`); extra fields MUST NOT be accepted. The intermediate state
    of a step lives in an explicit `state` and does not leave the action.

43. **The logic of an action is a pipeline of aspects.** Complex action logic
    MUST be laid out as aspects — pipeline steps run strictly top to bottom,
    without branches and side exits. Arbitrary functions or methods MUST NOT be
    created for business logic: every step is an aspect. An aspect is not
    inherited into the pipeline: the machine builds steps only from what is
    declared in the action itself.

44. **An action keeps no state.** Inside an action, fields and properties MUST
    NOT be used for storing intermediate state: the state is passed explicitly
    between aspects through `state`. The logic of aspects and their methods MUST
    NOT use global variables — only what comes from the parameters and the
    state.

45. **Dependencies are declared and resolved.** Everything external to an
    action MUST be declared in its header (`@depends`) and obtained through
    `box`; the machine MUST NOT hand out an undeclared dependency. The events of
    an action are written through `box`, not around it.

46. **Choosing between an action, an aspect and a resource.** The form of the
    logic MUST be chosen by signs, not by taste: long-lived state or transport
    logic → a resource; logic living only inside one scenario → an aspect; a
    self-contained operation used in several places, with its own input and
    output and a separate check → an action. One MUST start with an aspect;
    when an aspect repeats in two places, an action is extracted.

## Adapters

47. **An adapter is a bridge to a protocol.** The transport layer MUST live in
    an adapter, not in a handler beside the business logic: the adapter checks
    the request, builds the context, runs the action and turns the result into
    the protocol format. An action MUST NOT know about the transport.

48. **One action — several transports.** One action MUST go out to different
    protocols (for example HTTP and MCP) without changing the code: each
    protocol is a separate adapter built over the same action contract. Access
    is checked the same way for all transports.

49. **The schema comes from the contract, a mismatch is handled at the
    boundary.** The protocol schema MUST be built from the already declared
    action contract (input, output, descriptions), not written separately. A
    mismatch between the external schema and the contract MUST be translated at
    the adapter boundary, without changing the action.

## Code organisation

50. **Query fields are listed explicitly.** A database query MUST list the
    concrete fields; the `*` symbol MUST NOT be used. A new column must not get
    into the output unnoticed — the set of fields is chosen consciously.
    Check: resource queries contain no `*`; adding a column does not change the
    output until the field is listed.

51. **Constants live where they are used.** A value needed by **one** method
    MUST be declared as a constant **inside that method**, not at module or
    class level: a shared constant is visible to everyone, outlives its single
    meaning and invites reuse out of place. Only what is really shared by
    several places is moved out.
    Check: a value used by one method has no declaration at module or class
    level.

52. **A resource gives only meaningful methods.** A resource MUST NOT expose a
    generic pass-through method — `execute`, `fetch`, `query` and the like —
    through which the caller passes an arbitrary query or store statement. Each
    resource method MUST express a need of the domain: "fetch a user", "save an
    order". A pass-through method hides what exactly is asked of the store and
    hands the work with it back to the caller — that is, it moves the transport
    outside.
    Check: no resource method accepts an arbitrary query.

53. **A resource works with the store directly.** A resource is the layer to
    the real store: it MUST work with the store object (a connection, a client)
    directly and MUST NOT create one more layer inside itself — its own
    protocol, a "reader" or a store adapter. An extra layer hides what the
    resource really talks to and multiplies descriptions of one connection.
    The pool (rule 26) is the framework's own layer, not a layer of the
    resource: taking a connection from it is working with the store directly.
    Check: a resource has no intermediary types of its own over the store.

54. **The file is named like the class.** A file MUST be named after the class
    declared in it: `UserResource` lives in `user_resource.py`, `UserEntity` in
    `user_entity.py`. A class is searched for and edited by its name, not by a
    guess about how the author named the file; a mismatch of names forces one
    to keep an extra correspondence table in mind. The rule applies to **all**
    classes, not only to resources.
    Exceptions. The action contract — `Params` and `Result` — lives in the file
    of its action and MUST NOT require a separate file: the file is named after
    the action class written in snake_case. A lifecycle lives in the file of its
    entity (rule 16) and has no separate file. Test classes live in a
    `test_*.py` file: its name names what is tested, not the class. Classes of
    documentation tools are not covered by the rule.
    Check: the file name matches the class name written in snake_case; an
    action file may hold only its `Params` and `Result`, an entity file also
    its lifecycle.

## Authentication

55. **A bearer token and the standard check.** The client presents a JWT in the
    `Authorization: Bearer` header; the standard `JwtAuthCoordinator` checks
    it: the signature against an allow-list of algorithms, a mandatory `exp`,
    roles from the `roles` claim, a mandatory session claim
    (`session_id_claim`; in the project's services `sid`), without going to the
    database and without a sessions table. The session identifier is a
    correlator of the login, not a secret and not a means of revocation: AOA
    carries over the issuer's value and does not issue it itself. The login
    route is open (`NoAuthCoordinator`) — the caller has no token yet. An
    authorisation refusal discloses the reason to an allowed extent: it shows
    which step refused (the role or someone else's object) and the declared
    reason — enough for debugging, but the existence of a specific object and
    the correctness of a password are not disclosed. An authentication refusal
    (no token, a foreign signature, expiry) stays generic.
    Check: the reason for a refusal is declared and visible; enumerating
    existence is impossible.

56. **The token is issued by the authentication action.** The action MUST check
    the password against the hash read through a resource and, on success, sign
    a JWT (HS256): `sub` — the entity given access, `sid` — the login
    identifier (new on each successful login and the same when the token is
    refreshed within the same session), `roles` — the list of role names,
    `iat`, `exp`. The signing secret is a process setting: it comes from the
    environment, is not stored in the code and is not entity data. The lifetime
    is a parameter of issuing. Check: the password is compared with the hash;
    the secret is not read in the code.

57. **Roles are named classes; access is by role.** A role is an
    `ApplicationRole` class with a name and a description. The `roles` claim (a
    list of strings) is mapped to role classes by a registry; an unmapped name
    is dropped, not used to reject the token. Access to an action is set by
    `@check_roles`; an action open to anyone logged in uses
    `@check_roles(GuestRole)`. Check: every role is declared as a class, its
    name is in the registry, actions are protected by `@check_roles`.

58. **A password is sensitive data.** A password is declared with a secret type
    and MUST NOT get into logs, error texts, telemetry or `repr`. A value that
    still has to be shown is exposed as a public property with `@sensitive`
    (`@property` outside, `@sensitive` inside) and printed masked; internal
    names with a leading `_` do not pass into the template.
    Check: the password appears neither in logs nor in responses.

## Code format

59. **An aspect is declared on one line.** The method signature of an aspect —
    regular (`@regular_aspect`), summary (`@summary_aspect`), authorisation
    (`@access_decide`), error handling (`@on_error`) and compensation (saga) —
    is written on one line: the parameters are not split across lines. Check:
    every aspect lists its parameters on one line.

## Model graph

60. **The graph is built from what is loaded, not from a list.** Graph
    inspectors walk the **loaded** subclasses of the axes and find the declared
    classes themselves: listing actions and resources for building the graph is
    not required and MUST NOT be required — a list drifts from the code, and a
    declared class goes missing for the consumer of the graph. Therefore **each
    service gives its own graph**: a service MUST load all modules of its
    packages — by walking the package files, not by listing module names — and
    the graph MUST be complete with respect to the actions of **this** service
    and the shared resource layer. The completeness of the graph MUST NOT depend
    on a list of modules; a service MUST NOT give the action nodes of another
    service. The walk MUST be ordered: the build and its fingerprint are
    reproducible from run to run.
    A **service** is a self-contained package with its own entry point, its own
    actions, roles, exceptions, adapters, settings and tests, built into its own
    image and run as a separate process.
    Assembling the model domains is an exception: it is done by one explicit
    import, because the order of resolving references is set by the model, not
    by walking folders.
    Check: the graph build code has no list of action and resource modules, and
    an automatic check compares the graph with the declared classes found in the
    files of **its own** package.

## Data and input

61. **Identifiers are ASCII only.** Values that address rows — identifiers,
    references to them, enumeration codes, external identifiers and file names
    — MUST consist of ASCII characters only. Cyrillic look-alikes of Latin
    letters ("а", "е", "о", "с", "р", "х") MUST NOT be used: such a value looks
    the same as the right one, and search and comparison do not find it. A row
    identifier is written as a UUID in lower-case hex digits in the
    `8-4-4-4-12` format; a code in lower-case Latin letters, digits,
    underscore and hyphen. Natural-language text lives in names, descriptions
    and comments, not in identifiers.
    Check: an automatic walk over the snapshot literals rejects a non-ASCII
    character in an identifier and names the value and the file.

62. **Complex input is declared by a `Params` model.** A compound action input —
    a nested object, a list or a value with its own rules — MUST be described
    by a typed model and declared as a `Params` field. A raw untyped dict, an
    external value schema and parsing the body by hand MUST NOT be used: the
    request schema, its validation and the documentation are all derived from
    the model. The model checks the form and MUST NOT replace the values sent —
    normalisation and transformation stay a separate step of the action,
    otherwise a signature or a hash computed over the form sent stops matching.
    Check: the action has no fields without a declared type, and the form of
    the request is visible as a nested schema.

## Environment and context

63. **The environment enters an action only through a declared context.**
    Environment data — process settings, secrets, deployment parameters — MUST
    get into an action only through a declared context requirement: the value
    provider is registered on the context class, the action declares the
    context requirement key and reads the value through the context view.
    Reading the environment directly and calling the settings loader in action
    code MUST NOT occur — neither in aspects, nor in input and result models,
    nor in their checks: such a dependency is visible neither in the
    declaration nor in the graph and cannot be substituted at the boundary.
    Reading the environment stays where the process configuration lives: in the
    settings loader — the only place that reads the environment — and in the
    adapter that binds the transport.
    Check: action code has no call of the settings loader and no reading of the
    environment; every value used is declared by a context requirement key.

64. **The graph names every environment key.** Every declared context
    requirement MUST be visible in the graph as a node named after the key: the
    node names which environment value the action uses. The check compares
    declarations and nodes both ways: a declared key without a node and a node
    without a declaration — both mismatches fail with the action name; a list of
    modules MUST NOT be required for this, and the check MUST NOT require a
    store. The value of a setting MUST NOT get into the graph — only the key
    name, the secret stays closed (rule 58). The completeness of the graph is
    checked with respect to the actions of this service and the shared resource
    layer (rule 60).
    The execution context MUST be such that a declared key resolves: declaring
    a key that does not resolve on a request is a false declaration. The
    requirement applies to any transport: the action contract is one, but each
    transport must build a context on which the declaration works.
    Check: every declared key has a graph node, every node has a declaration,
    and a declared key resolves on a request.

65. **An action is isolated: global variables are forbidden, constants are
    allowed.** An action MUST get data only through declared channels: input
    parameters, the state of earlier steps, declared dependencies, links and the
    declared context. Reading a **global variable** — a mutable module-level
    value: an accumulator, a registry, a cache, a counter, a singleton object, a
    shared mutable structure — MUST NOT occur in action code: it is an input
    around the declared channels, it can be neither declared, nor seen in the
    graph, nor substituted at the boundary.
    Reading a **constant** — a module-level value that is immutable in fact —
    MUST be allowed: a constant carries no state and does not change between
    calls. The sign of a constant is the immutability of the value, not the
    name and not a mark at declaration: the language gives no immutable names,
    and the ban rests on the value itself.
    Allowed access to shared names: types, classes, enumerations, errors,
    declarations and pure functions without state of their own. Calling a
    function behind which a shared mutable variable stands is reading that
    variable.
    The rule applies to the whole action: aspects of every kind, input and
    result models and their checks; it extends and strengthens rule 44.
    Check: a walk over the action code finds the reading of a module-level name
    with a mutable value and names the action, the method and the name; a value
    of an immutable type does not fail the check.

## Connections in routes

66. **A route connection is declared in place.** The route declaration
    (`connections={…}`) MUST show what exactly is passed: a ready resource or a
    `PerCallConnection` with a factory and a finaliser. The finaliser MAY be a
    lambda `lambda resource: resource.close()` — this is enough, a separate
    named function is not required. Hiding this choice behind
    `build_resources`, tuple unpacking, a shared factory returning
    `BaseResource | PerCallConnection` or any other wrapper MUST NOT happen: the
    reader of a route must understand in place whether a resource is created per
    call and who returns the connection. Check: in the application file the
    `connections` declaration contains a `PerCallConnection` or a ready
    resource; an AST walk finds no wrapper returning a union.

## Graph history

67. **The graph is stored as a file beside the service.** Every package that
    gives a graph (`/graph` or `/graph-json`) MUST have an exporter
    `build_graph.py` in the package root and a `graph.json` file beside it; both
    are listed in `graph-builder.toml` in the repository root. The graph file
    MUST NOT be edited by hand: only `./update-graphs.sh` writes it. An edit
    that changes the model, resources, actions, roles or the AOA pin runs
    `./update-graphs.sh` as its last step — after green tests — and commits the
    changed `graph.json` files in the same phase. The history of the graph is
    the history of this file in git; there are no separate snapshots or
    indexes.
    Check: CI runs `graph-builder check` and fails if the graph file does not
    match what the exporter prints.

## Merging

68. **A pull request with a red check is not merged.** Before merging into
    `main` the result of all PR checks on its last commit MUST be read,
    including `version` and `graph-files`. If a check failed, is still running,
    did not start, or the branch is behind `main`, the merge MUST NOT be done:
    the executor refuses, names the reason and what has to be fixed. GitHub
    settings do not enforce this ban, so it rests on this rule; a request to
    merge the PR "as is" does not lift it — the cause is fixed first.
    Check: `gh pr checks <number>` shows all checks green,
    `gh pr view <number> --json mergeStateStatus` shows `CLEAN`.

## Pull requests

69. **A pull request is assigned to the maintainer.** Every pull request MUST be
    opened with the maintainer (`bystrovmaxim`) as its assignee, in the same
    command that opens it (`gh pr create --assignee bystrovmaxim`). A pull
    request without an assignee drops out of the maintainer's list of work.
    Check: `gh pr view <number> --json assignees` names the maintainer.

70. **Automatic CI fixing is always on.** Right after a pull request is opened,
    the executor that opened it MUST turn on automatic CI fixing (Auto-fix) for
    it, so that a failed check, a merge conflict or a review comment wakes the
    executor and is fixed without waiting to be noticed. It is not asked about
    and not left off: the maintainer turned it on once for every pull request.
    Automatic fixing never merges: rule 68 still decides the merge.
    Check: the pull request's CI monitor shows Auto-fix on.

71. **Browser checks run alongside CI.** The browser checks that CI cannot run
    (`scripts/check_before_pr.sh`) MUST start right after every push to a
    pull request branch, on the pushed commit, while CI runs on the same
    commit: the executor MUST NOT wait for CI to finish, for the pull request
    to open or for a request to run them. The two runs overlap, so the pull
    request is ready when the longer of them ends, not after both in a row.
    The commit status they leave belongs to one commit: every new commit
    pushed to the branch MUST get a new run, started the same way.
    Check: the last commit of the pull request carries the status
    `Local check run`, set no later than CI's checks on it ended plus the
    length of one browser run.

## Governance

- The constitution stands above all other practices. In a conflict between a
  specification and the constitution the constitution rules, and the
  specification is corrected. Weakening a principle "in place" is NOT ALLOWED.
- The constitution does not describe a domain. Terms, entities and mechanics of
  a particular domain live only in the specification; an attempt to put them
  here is a mistake, not an addition.
  Names of tables, entities, enumerations and fields of the current project
  MUST NOT appear in the document; examples are allowed only abstract ones that
  explain the form.
  **The exception is the service time fields:** their names (`created_at`,
  `updated_at`) are given directly, because this is a form shared by all
  tables, not a domain; the exception is narrow — exactly these two names.
  Everything else that names a concrete table, entity or field lives in the
  feature specification, the tasks or the passport. An amendment of the
  constitution that breaks this MUST NOT be accepted.
- The constitution describes development on AOA, not only the database: today
  it covers the schema and the data, and the other topics of the framework are
  added here as they appear.
- An amendment is made only through `speckit-constitution` and comes with a
  version bump: MAJOR — removing or redefining a principle, MINOR — a new
  principle or section, PATCH — clarifying wording without changing the
  meaning.
- Every specification and every plan is checked against the constitution; the
  Constitution Check section of the plan is filled in by these principles.
- The language of the constitution, specifications and documentation is
  English; names of entities, tables, columns and files are English. A Russian
  draft (`*.ru_draft.md`) MAY live beside an English page and never enters a
  commit.
- The sources of truth about the data structure are the constitution, `specs/`
  and `schema/`. There are no others.

**Version**: 1.5.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-06
