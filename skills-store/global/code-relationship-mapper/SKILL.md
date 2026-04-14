# code-relationship-mapper

## Purpose

Create a complete, agent-friendly understanding of a selected code project by:

1. Reading all source code files in scope.
2. Mapping relationships between modules, classes, functions, and data flow.
3. Producing layered Markdown documentation.
4. Capturing function-level call and return behavior for every function in scope.

## When To Use

Use this skill when user asks for:

- full codebase analysis
- code relationship mapping
- call graph and dependency graph
- architecture understanding docs
- function-level caller/callee/return tracing

## Required Outcomes

This skill MUST produce documentation that is:

- complete for the selected scope
- precise down to each function's calls and returns
- structured for fast agent reading
- linkable with stable IDs and relative links

## Scope Rules

Before analysis, define scope explicitly:

- `project_root`: root folder to analyze
- `include_patterns`: source file globs
- `exclude_patterns`: vendor/build/cache/generated paths
- `language_set`: detected or user-specified languages

If user does not specify, default include:

- `**/*.py`, `**/*.js`, `**/*.ts`, `**/*.tsx`, `**/*.jsx`, `**/*.java`, `**/*.go`, `**/*.rs`, `**/*.cs`, `**/*.cpp`, `**/*.c`, `**/*.h`, `**/*.hpp`, `**/*.php`, `**/*.rb`, `**/*.swift`, `**/*.kt`

Default exclude:

- `**/node_modules/**`, `**/.git/**`, `**/dist/**`, `**/build/**`, `**/out/**`, `**/.next/**`, `**/target/**`, `**/__pycache__/**`, `**/coverage/**`, `**/vendor/**`, `**/*.min.*`

## Output Location

Write documentation to:

- `docs/code-map/`

If folder does not exist, create it.

## Output Files (Layered)

Generate these files in order:

1. `docs/code-map/00-overview.md`
2. `docs/code-map/01-module-map.md`
3. `docs/code-map/02-dependency-map.md`
4. `docs/code-map/03-call-graph.md`
5. `docs/code-map/04-function-index.md`
6. `docs/code-map/05-dataflow-return-map.md`
7. `docs/code-map/06-entrypoints-and-routes.md`
8. `docs/code-map/07-external-interfaces.md`
9. `docs/code-map/08-hotspots-and-risks.md`
10. `docs/code-map/99-glossary-and-ids.md`

When codebase is large, add per-module detail pages:

- `docs/code-map/modules/<module-id>.md`

## Function-Level Precision Standard

For EACH function/method in scope, capture:

- stable function ID
- file path and line
- signature (name, params, return annotation if present)
- direct callers (internal)
- direct callees (internal)
- external/library calls (grouped)
- return behavior:
  - return type annotation or inferred shape
  - all distinct return paths
  - sentinel returns (`null`, `None`, error objects, empty collections)
- side effects (I/O, DB, network, file write, global state)
- error behavior (throws/raises/returns error)
- async/concurrency behavior

If exact return type cannot be proven, mark as:

- `unknown (static inference limited)`

Do not fabricate.

## Markdown Format Contract

Use compact, scan-friendly Markdown with strict structure.

### A. Header Block

Every file starts with:

```md
# <title>

Generated: <ISO datetime>
Scope: <short scope>
Confidence: <high|medium|low>
```

### B. Stable IDs

Use IDs:

- module: `M-<slug>`
- class: `C-<slug>`
- function: `F-<slug>`

Keep IDs stable across reruns unless path/name changes.

### C. Function Record Template

Use this exact block shape in `04-function-index.md` and module pages:

```md
## F-<slug> `<function_name>`

- Location: `<path>:<line>`
- Parent: `<module-or-class-id>`
- Signature: `<raw signature>`
- Calls: `F-...`, `F-...`
- Called by: `F-...`, `F-...`
- External calls: `<lib.fn>`, `<lib.fn>`
- Returns:
  - Path A: `<condition>` -> `<value/type>`
  - Path B: `<condition>` -> `<value/type>`
- Side effects: `<none|list>`
- Errors: `<none|throws/raises/returns error>`
- Async: `<sync|async|mixed>`
- Notes: `<brief fact only>`
```

### D. Call Graph Tables

In `03-call-graph.md`, include:

- top-down call chains from entrypoints
- fan-in/fan-out table
- cycles (if any)

Table format:

```md
| Function ID | Fan-in | Fan-out | Layer | Notes |
|---|---:|---:|---|---|
```

### E. Return Map

In `05-dataflow-return-map.md`, include:

- function -> return type/shape summary table
- uncertain inferences grouped separately
- error/exception return channels

## Execution Workflow

1. **Inventory**
   - enumerate files in scope
   - group by module/package
2. **Symbol extraction**
   - collect classes/functions/methods/signatures
3. **Relationship extraction**
   - imports and dependencies
   - caller/callee graph
4. **Return-path analysis**
   - enumerate return statements and conditions
5. **Entrypoint analysis**
   - CLI, HTTP routes, main functions, workers, schedulers
6. **Markdown generation**
   - write required files with stable IDs and links
7. **Consistency pass**
   - verify each referenced ID exists
   - verify each function appears at least once in index

## Quality Gates

Before finalizing, MUST verify:

- `function_coverage == 100%` for in-scope functions
- all `Calls` and `Called by` IDs resolve
- all files have generated timestamp and confidence
- no broken relative links
- unknown items explicitly marked (not omitted)

If any gate fails, fix and regenerate affected files.

## Fast-Read Optimizations For Agents

Always optimize for machine + human scan:

- short bullets
- consistent field order
- no narrative padding
- no duplicated long prose
- prefer tables and ID links for traversal
- keep each function block concise

## Non-Goals

- no runtime profiling unless user requests
- no code changes unless user requests
- no speculative behavior claims without evidence

## Minimal Command Checklist

When executing this skill, follow this checklist:

1. detect scope
2. build symbol map
3. build dependency map
4. build call graph
5. build return map
6. write layered Markdown docs
7. run consistency gates
8. report completion with file list and coverage stats
