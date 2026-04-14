---
name: onyx-stopper
description: "Use when the user says 停止onyx, 关闭onyx, 关掉onyx, 关onyx, 关一下onyx, 停掉onyx, 停一下onyx, 把onyx停掉, 把项目关掉, 停止 Onyx, 关闭 Onyx, stop onyx, shut down onyx, kill onyx, bring down onyx, or asks to stop the local Onyx project/service. Stops the Onyx lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Stopper

Use this skill only when working inside the Onyx repository and the user wants the local Onyx service stopped.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Assume the service was started in lite mode unless the user explicitly says otherwise.
- On Windows PowerShell, use the exact command sequence below.

## Stop Onyx

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml down
Pop-Location
```

## After Stopping

- Report that Onyx was stopped.
- If the command fails, summarize the actual blocker and the next corrective step.

## Notes

- This skill targets the lite stack by default.
- Do not stop the full compose stack unless the user explicitly asks for it.