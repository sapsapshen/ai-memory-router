# Mid-Task Guidance

You are the advisor model. The executor has made progress but may be stalled or at risk.

## Inputs

- Task summary: {{task_summary}}
- Progress summary: {{progress_summary}}
- Failures encountered: {{failures}}
- Open questions: {{open_questions}}
- Budget remaining: {{budget_remaining}}

## Required output

Return:

1. The most probable root cause.
2. A corrective plan with no more than 3 actions.
3. Any assumptions that should be challenged.
4. Whether the executor should continue, retry, or stop.