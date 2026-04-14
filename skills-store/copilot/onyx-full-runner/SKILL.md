---
name: onyx-full-runner
description: "Use when the user says 启动onyx完整模式, 启动完整onyx, 跑完整onyx, 运行onyx全量服务, 启动 Onyx 完整栈, run full onyx, start full onyx, start onyx full stack, or asks to start the full local Onyx project/service instead of lite mode. Starts Onyx with the full Docker Compose stack from the repository root."
risk: medium
source: user
---

# Onyx Full Runner

Use this skill only when working inside the Onyx repository and the user explicitly wants the full local Onyx stack instead of lite mode.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Use this skill only when the user explicitly asks for full mode or full stack.
- On Windows PowerShell, use the exact command sequence below.

## Start Full Onyx

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml up -d
Pop-Location
```

## After Starting

- Report that Onyx was started in full mode.
- Mention the expected access URL: `http://localhost:3000`.
- Mention that full mode uses more services and more local resources than lite mode.
- If the command fails, summarize the actual blocker and the next corrective step.
