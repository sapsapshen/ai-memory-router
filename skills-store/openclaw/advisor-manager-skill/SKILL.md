---
name: advisor-claw-skill
description: Orchestrate low-cost executor models with high-intelligence advisor models for complex or high-risk turns. Use when a task needs dynamic escalation, budget-aware planning, strategic review, or model-cost optimization without hard-coding a single provider.
emoji: "🧠"
version: "1.0.0"

dependencies:
  binaries: ["node"]
  env:
    - ANTHROPIC_API_KEY
    - OPENAI_API_KEY
    - DEEPSEEK_API_KEY

tools:
  allow:
    - read
    - write
    - exec
    - gateway
    - subagents

metadata:
  openclaw:
    category: model-orchestration
    priority: 90
    compatibility:
      min_version: "1.8.0"
    entrypoint: "scripts/index.js"
---

# Advisor Claw Skill

## Purpose

Route most work through an economical executor model and escalate to an advisor model only when the task is risky, stalled, ambiguous, or strategically complex.

After installation, the user can configure candidate models through OpenClaw conversation in either of two ways:

- reuse models already configured in OpenClaw
- add external models by supplying provider metadata and API keys

The skill should then infer role placement from model strength and cost, rather than requiring the user to hard-code advisor and executor assignments.

The skill must reject invalid model setup unless the user provides exactly 2 models.

## Trigger Guidance

Activate this skill when any of the following are true:

- The task explicitly mentions budget control, model routing, or advisor strategy.
- The task is long-running and may require mid-course review.
- The task mixes execution with architectural or quality-risk decisions.
- The user wants lower-cost models to do most of the work while preserving high-quality outcomes.

Do not activate this skill when:

- A single deterministic script is enough.
- No model-routing decision is required.
- The task is pure documentation with no execution loop or escalation policy.

## Operating Rules

1. Start with executor-first routing.
2. Reserve advisor budget before the first advisor call.
3. Sanitize and compact context before escalation.
4. Use a weighted decision score, not a single threshold.
5. Require a final review only if budget reserve is still intact.
6. Fall back cleanly if a provider is unavailable.
7. Emit a deterministic result object with cost, decisions, and review trail.

## Workflow

1. Load `config/default.yaml`, `config/roles.yaml`, and `config/strategies.yaml`.
2. Accept user-provided candidate models from OpenClaw-configured models and optional external API-key models.
3. Validate that exactly 2 models were provided.
4. Detect whether each model already exists in OpenClaw configuration.
5. Reuse OpenClaw-configured models directly; require an API key for any model not already configured.
6. Score model strength and cost, then assign advisor and executor automatically unless an explicit pin is provided.
7. Classify the task: complexity, risk, uncertainty, and expected iteration count.
8. Select strategy: `balanced`, `cost_saver`, or `quality_first`.
9. Run executor passes while recording progress, failures, spend, and command history into `out/*.md`.
10. On exceptions, retry remediation up to 5 rounds: executor first for 3 attempts, then advisor for 2 attempts.
11. Ask the decision engine whether advisor escalation is justified.
12. If escalation is allowed, build a redacted advisor brief from current task state.
13. Apply returned guidance to the next executor pass.
14. Finish with optional quality review if reserve budget remains.

## Output Contract

Return JSON with the following shape:

```json
{
  "taskId": "string",
  "strategy": "balanced",
  "status": "completed",
  "roleAssignments": {
    "executor": "gpt-4o-mini",
    "advisor": "claude-opus"
  },
  "advisorCalls": 2,
  "cost": {
    "executorUsd": 0.42,
    "advisorUsd": 0.18,
    "totalUsd": 0.60,
    "budgetRemainingUsd": 4.40
  },
  "decisionTrail": [],
  "artifacts": [],
  "warnings": [],
  "logFile": "out/20260410T101500-example-task.md"
}
```

## Notes

- Provider-specific beta headers belong in provider adapters, not the top-level skill contract.
- Model names are aliases in config and can be pinned later without changing orchestration logic.
- Execution history is persisted in Markdown under `out/` in chronological order.
- Recovery policy is fixed at 5 attempts total: 3 executor attempts, then 2 advisor attempts, then a runtime exception with stack trace.
- This skill scaffolds orchestration behavior; API wiring is intentionally isolated behind `ProviderClient`.