# Conversation Setup Flow

After the skill is installed, the intended OpenClaw dialogue flow is:

1. User asks to configure candidate models.
2. Skill accepts either:
   - models already configured in OpenClaw
   - external models accompanied by provider metadata and API-key env names
3. Skill enforces a hard rule: exactly 2 models must be provided.
4. Skill checks whether each model already exists in the official OpenClaw config surfaces:
   - `~/.openclaw/openclaw.json`
   - optional project `openclaw.config.json`
   - official JSON5 `$include` expansions inside those configs
5. If a model is already configured, that configuration is reused directly.
6. If a model is not already configured, the user must provide an API key.
7. `ModelRegistry` normalizes the two models into a common profile.
8. The strongest strategic model becomes advisor.
9. The cheapest sufficiently capable model becomes executor.

Validation messages must be explicit:

- `Advisor Claw Skill requires exactly 2 models, but received N. Please configure exactly 2 models before using this skill.`
- `Model "X" is not configured in OpenClaw. Please provide an API key before using this skill.`

Auto-discovery sources:

- `OPENCLAW_CONFIG_PATH`
- `~/.openclaw/openclaw.json`
- project `openclaw.config.json`

Official config fields used for model detection:

- `models.providers`
- `models.providers.*.models[]`
- `agents.defaults.models`
- `agents.defaults.model`
- `agents.list[].model`

Recommended conversation fields:

- alias
- provider
- model name
- source
- api key env name when external
- optional strength score override
- optional cost score override