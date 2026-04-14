---
name: onyx-reset
description: "Use when the user says 重置onyx, 重置 Onyx, 重新拉起onyx, 重新部署onyx, reset onyx, re-create onyx, rebuild onyx stack, or asks to tear down and recreate the local Onyx service cleanly. Resets the Onyx lite Docker Compose stack from the repository root without deleting volumes."
risk: medium
source: user
---

# Onyx Reset

Use this skill only when working inside the Onyx repository and the user wants a clean non-destructive reset of the local Onyx lite stack.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the lite stack is the target unless the user explicitly says otherwise.
- Do not delete volumes unless the user explicitly asks for a destructive reset.
- On Windows PowerShell, use the exact command sequence below.

## Reset Onyx

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml down --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml up -d
Pop-Location
```

## After Resetting

- Report that Onyx was reset in lite mode.
- Mention the expected access URL: `http://localhost:3000`.
- If the command fails, summarize the actual blocker and the next corrective step.

## Notes

- This reset is non-destructive because it does not remove volumes.
- If the user wants a destructive reset, ask explicitly before using `down -v`.
