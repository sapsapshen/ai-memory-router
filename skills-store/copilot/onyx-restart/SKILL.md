---
name: onyx-restart
description: "Use when the user says 重启onyx, 重新启动onyx, 重开onyx, 把onyx重开一下, 重新拉起onyx, 重启 Onyx, restart onyx, reboot onyx, or asks to restart the local Onyx project/service. Restarts the Onyx lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Restart

Use this skill only when working inside the Onyx repository and the user wants the local Onyx service restarted.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the lite stack is the target unless the user explicitly says otherwise.
- On Windows PowerShell, use the exact command sequence below.

## Restart Onyx

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml down
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml up -d
Pop-Location
```

## After Restarting

- Report that Onyx was restarted in lite mode.
- Mention the expected access URL: `http://localhost:3000`.
- If the command fails, summarize the actual blocker and the next corrective step.

## Notes

- This skill targets the lite stack by default.
- Do not switch to the full compose stack unless the user explicitly asks for it.