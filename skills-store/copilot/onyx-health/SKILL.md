---
name: onyx-health
description: "Use when the user says 检查onyx健康, onyx健康, 看看onyx健不健康, onyx正常吗, onyx能不能访问, 检查 Onyx 是否正常, health onyx, onyx health, verify onyx, test onyx, or asks to verify the local Onyx project/service is healthy and reachable. Checks service status and endpoint reachability for the Onyx lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Health

Use this skill only when working inside the Onyx repository and the user wants to verify that local Onyx is healthy and reachable.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the lite stack is the target unless the user explicitly says otherwise.
- On Windows PowerShell, use the exact command sequence below.

## Check Health

Run these commands in order:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml ps
Pop-Location
curl.exe -I --max-time 15 http://localhost:3000/
curl.exe http://localhost:3000/api/health --max-time 15
```

## After Checking

- Summarize whether the core services are up.
- Confirm whether `http://localhost:3000` is reachable.
- Confirm whether `/api/health` returns a healthy response.
- If something fails, identify the failing layer: compose, nginx, web server, or API server.

## Notes

- Treat `api_server`, `web_server`, `nginx`, and `relational_db` as the core lite services.
- Prefer `curl.exe` over PowerShell web cmdlets for reachability checks in this repository.