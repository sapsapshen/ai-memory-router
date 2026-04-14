# code-relationship-mapper

Analyze a selected project and produce layered Markdown documentation that maps code relationships with function-level precision.

## What this skill does

- Reads all in-scope source files.
- Maps module/class/function relationships.
- Builds call graph (caller/callee) and dependency graph.
- Captures return-path details for every function.
- Writes agent-friendly docs under `docs/code-map/`.

## Output

Main outputs:

- `docs/code-map/00-overview.md`
- `docs/code-map/01-module-map.md`
- `docs/code-map/02-dependency-map.md`
- `docs/code-map/03-call-graph.md`
- `docs/code-map/04-function-index.md`
- `docs/code-map/05-dataflow-return-map.md`
- `docs/code-map/06-entrypoints-and-routes.md`
- `docs/code-map/07-external-interfaces.md`
- `docs/code-map/08-hotspots-and-risks.md`
- `docs/code-map/99-glossary-and-ids.md`

Optional large-project detail pages:

- `docs/code-map/modules/<module-id>.md`

## Precision guarantee

Each function block includes location, signature, callers, callees, external calls, return paths, side effects, error behavior, and async behavior.

Unknown values are explicitly labeled as unknown.

## Best use cases

- onboarding new agents to unfamiliar codebases
- preparing architecture context for refactor tasks
- generating dependency and call-chain references
- documenting return behavior before API changes
