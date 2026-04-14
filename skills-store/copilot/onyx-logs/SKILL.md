---
name: onyx-logs
description: "Use when the user says 查看onyx日志, onyx日志, 看日志, 看下onyx日志, onyx报错, 查看 Onyx 日志, logs onyx, onyx logs, show onyx logs, tail onyx logs, or asks to inspect logs for the local Onyx project/service. Shows recent logs from the Onyx lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Logs

Use this skill only when working inside the Onyx repository and the user wants to inspect local Onyx logs.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the lite stack is the target unless the user explicitly says otherwise.
- On Windows PowerShell, use the exact command sequence below.

## Show Logs

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml logs --tail 100 nginx web_server api_server
Pop-Location
```

## After Showing Logs

- Summarize the important errors, warnings, or health signals instead of dumping raw output only.
- Mention if the core services appear healthy.
- If the user asks for another service specifically, adapt the service list accordingly.

## Notes

- Default to `nginx`, `web_server`, and `api_server` because they cover most user-facing failures.
- Do not inspect the full compose stack unless the user explicitly asks for it.
