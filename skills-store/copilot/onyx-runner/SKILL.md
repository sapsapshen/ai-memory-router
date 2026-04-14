---
name: onyx-runner
description: "Use when the user says 运行onyx, 启动onyx, 打开onyx, 开onyx, 开一下onyx, 跑onyx, 跑一下onyx, 把onyx跑起来, 把onyx开起来, 把项目启动起来, onyx启动一下, 启动 Onyx, 运行 Onyx, 打开 Onyx, run onyx, start onyx, launch onyx, boot onyx, bring up onyx, or asks to start the local Onyx project/service. Starts Onyx with the lite Docker Compose stack from the repository root."
risk: low
source: user
---

# Onyx Runner

Use this skill only when working inside the Onyx repository and the user wants the local Onyx service started or restarted.

## Preconditions

- Confirm the workspace contains `deployment/docker_compose/docker-compose.yml`.
- Prefer the lite stack unless the user explicitly asks for the full stack.
- On Windows PowerShell, use the exact command sequence below.

## Start Onyx

Run this command sequence in the terminal:

```powershell
Push-Location deployment/docker_compose
docker compose -f docker-compose.yml -f docker-compose.onyx-lite.yml up -d
Pop-Location
```

## After Starting

- Report that Onyx was started in lite mode.
- Mention the expected access URL: `http://localhost:3000`.
- If the command fails, summarize the actual blocker and the next corrective step.

## Notes

- Lite mode keeps the local deployment smaller and is the default for this skill.
- Do not switch to the full compose stack unless the user explicitly asks for it.
