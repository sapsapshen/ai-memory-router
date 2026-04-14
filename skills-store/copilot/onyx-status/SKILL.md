---
name: onyx-status
description: "Use when the user says 查看onyx状态, onyx状态, 检查onyx, 看看onyx, 看下onyx状态, 看看onyx起来没, onyx还在吗, onyx在不在, 查看 Onyx 状态, check onyx status, onyx status, is onyx running, or asks whether the local Onyx project/service is running. Checks the lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Status

Use this skill only when working inside the Onyx repository and the user wants to know whether the local Onyx service is running.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the lite stack is the target unless the user explicitly says otherwise.
- On Windows PowerShell, use the exact command sequence below.

## Check Status

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml ps
Pop-Location
```

## After Checking

- Summarize whether Onyx is up.
- If available, mention the expected access URL: `http://localhost:3000`.
- If core services are missing or unhealthy, say which ones.

## Notes

- Treat `api_server`, `web_server`, `nginx`, and `relational_db` as the core lite services.
- Do not inspect the full compose stack unless the user explicitly asks for it.
