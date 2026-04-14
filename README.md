# AI Memory Router

> 跨 AI 工具的记忆与技能迁移系统 — Migrate memories & skills across AI coding tools seamlessly.

<p align="center">
  <a href="#zh-intro"><strong>🇨🇳 中文</strong></a> ·
  <a href="#en-intro"><strong>🇬🇧 English</strong></a>
</p>

---

## 📖 简介 / Introduction

<details open>
<summary><strong>🇨🇳 中文介绍</strong></summary>

AI Memory Router 是一个跨 AI 编码工具的记忆与技能迁移系统。它扫描已安装 AI 工具的本地记忆文件和技能目录，提供可视化 Web 界面，让用户可以**选择性地将记忆和技能从一个工具迁移到另一个工具**。

### 为什么需要记忆迁移？

| 场景 | 问题 | 迁移方案 |
|------|------|----------|
| **切换到 Claude Code** | 每次打开新项目需手动输入项目规范、编码约定 | 将其他工具积累的 `project` 类型记忆迁移到 Claude Code，自动注入项目上下文 |
| **重装 OpenClaw** | 本地记忆丢失，需重新学习工作习惯和工具链 | 迁移 `user` / `feedback` 类型记忆，快速恢复个人工作流配置 |
| **多工具并行开发** | 不同工具间技能不互通，重复安装和配置 | 将技能批量迁移至目标工具，一套技能多处使用 |
| **团队协作** | 团队成员使用不同 AI 工具，知识无法共享 | 统一导出为中间格式，再分发到各自工具 |

### 迁移收益量化

```
迁移前：Claude Code 新建项目
  → 手动输入项目规范 (~15 min)
  → 配置编码约定 (~10 min)
  → 设置架构文档 (~20 min)
  → 总计 ~45 min / 项目

迁移后：导入已有记忆
  → 一键迁移 (~5 sec)
  → 自动加载全部上下文
  → 节省 ~98% 配置时间
```

</details>

<details>
<summary><strong>🇬🇧 English Introduction</strong></summary>

AI Memory Router is a memory and skill migration system for AI coding tools. It scans local memory files and skill directories from installed AI tools and provides a web-based UI for **selectively migrating memories and skills between tools**.

### Why Memory Migration?

| Scenario | Problem | Solution |
|----------|---------|----------|
| **Switching to Claude Code** | Manual project spec input required every session | Migrate `project`-type memories from other tools for automatic context injection |
| **Reinstalling OpenClaw** | Lost memories, need to relearn workflows and toolchain | Restore `user` / `feedback` memories for instant workflow recovery |
| **Multi-tool development** | Skills don't transfer between tools, duplicate setup needed | Batch migrate skills — one set, use everywhere |
| **Team collaboration** | Different AI tools, no shared knowledge base | Export to intermediate format, distribute to each tool |

### Migration ROI

```
Before Migration: New project in Claude Code
  → Manual project specs (~15 min)
  → Coding conventions setup (~10 min)
  → Architecture docs setup (~20 min)
  → Total ~45 min / project

After Migration: Import existing memories
  → One-click migrate (~5 sec)
  → Auto-load all context
  → Save ~98% setup time
```

</details>

---

## 🏗️ 架构 / Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   AI Memory Router                       │
│  ┌───────────┐   ┌───────────┐   ┌───────────────────┐  │
│  │  Scanner   │   │  Adapter  │   │      Writer       │  │
│  │           │──▶│  System   │──▶│  memory-store/    │  │
│  │ 16 tools   │   │ Source/   │   │  skills-store/    │  │
│  └───────────┘   │  Target   │   └─────────┬─────────┘  │
│                  └───────────┘             │            │
│  ┌─────────────────────────────────────────▼─────────┐  │
│  │              Hono HTTP Server                      │  │
│  │  /api/memories  /api/skills  /api/migrate         │  │
│  └────────────────────────┬──────────────────────────┘  │
│                           │                             │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │              Web UI (Frosted Glass)               │  │
│  │  Memory Tree · Skill Cards · Filter · Migrate     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🔧 支持的工具 / Supported Tools

| 工具 / Tool | 记忆 / Memory | 技能 / Skills | 模式 / Mode |
|-------------|:-------------:|:-------------:|-------------|
| Claude Code | ✅ | ✅ | Source + Target |
| OpenClaw | ✅ | ✅ | Source + Target |
| Cline | ✅ | ✅ | Source + Target |
| Cursor | ✅ | ✅ | Source + Target |
| GitHub Copilot | ✅ | ✅ | Source + Target |
| Codex CLI | ✅ | ✅ | Source + Target |
| Continue | ✅ | ✅ | Source + Target |
| Gemini CLI | ✅ | ✅ | Source + Target |
| Windsurf | ✅ | ❌ | Source Only |
| Roo-Code | ✅ | ✅ | Source + Target |
| Aider | ✅ | ❌ | Source Only |
| Amazon Q | ✅ | ❌ | Source Only |
| Augment | ✅ | ❌ | Source Only |
| Hermes | ✅ | ✅ | Source + Target |
| Global Skills | — | ✅ | Source Only |

## 🚀 快速开始 / Quick Start

### 安装 / Installation

```bash
cd ai-memory-router
npm install
npm start
```

> **注意 / Note:** 启动时如遇 `EADDRINUSE: address already in use :::7890`，说明已有实例在运行，需先关闭旧进程。

<details>
<summary><strong>🇨🇳 关闭占用端口</strong></summary>

```bash
# Windows — 查找并关闭占用 7890 端口的进程
netstat -ano | findstr :7890
taskkill /PID <PID> /F

# macOS / Linux
lsof -ti :7890 | xargs kill -9
```

</details>

<details>
<summary><strong>🇬🇧 Close Occupied Port</strong></summary>

```bash
# Windows — Find and kill the process on port 7890
netstat -ano | findstr :7890
taskkill /PID <PID> /F

# macOS / Linux
lsof -ti :7890 | xargs kill -9
```

</details>

启动后自动打开 `http://localhost:7890`。
Browser opens automatically at `http://localhost:7890`.

### 使用 / Usage

<details open>
<summary><strong>🇨🇳 中文使用指南</strong></summary>

1. **浏览记忆** — 左侧树形结构按类型和来源工具分类
2. **浏览技能** — 点击左侧平台名称筛选，右侧卡片展示技能详情
3. **选择迁移** — 勾选记忆或技能，选择目标工具，点击迁移
4. **查看结果** — 弹窗显示备份路径和写入位置

```
┌──────────────┐    ┌─────────────────────────┐
│  Sidebar     │    │  Main Content            │
│              │    │                          │
│ ▼ 全部记忆    │    │  User 记忆               │
│   Claude Code│    │  📄 project-rules.md     │
│   OpenClaw   │    │  📄 coding-style.md      │
│ ▼ 全部技能平台│    │                          │
│   Cursor     │    │  Project 记忆             │
│   Cline      │    │  📄 architecture.md      │
│   Copilot    │    │  📄 api-conventions.md   │
└──────────────┘    └─────────────────────────┘
                     [迁移 2 条记忆] → [Claude Code]
```

</details>

<details>
<summary><strong>🇬🇧 English Usage Guide</strong></summary>

1. **Browse Memories** — Hierarchical tree by type and source tool
2. **Browse Skills** — Click platform name in sidebar to filter, cards show details
3. **Select & Migrate** — Check memories or skills, pick target tool, click migrate
4. **View Results** — Popup shows backup paths and written locations

```
┌──────────────┐    ┌─────────────────────────┐
│  Sidebar     │    │  Main Content            │
│              │    │                          │
│ ▼ All        │    │  User Memories           │
│   Claude Code│    │  📄 project-rules.md     │
│   OpenClaw   │    │  📄 coding-style.md      │
│ ▼ All Platforms│   │                          │
│   Cursor     │    │  Project Memories        │
│   Cline      │    │  📄 architecture.md      │
│   Copilot    │    │  📄 api-conventions.md   │
└──────────────┘    └─────────────────────────┘
                     [Migrate 2] → [Claude Code]
```

</details>

## 📊 记忆类型 / Memory Types

| 类型 / Type | 说明 / Description | 迁移价值 / Migration Value |
|-------------|-------------------|--------------------------|
| **User** | 用户偏好、工作习惯、个人知识 / Preferences, habits, personal knowledge | 跨工具保持工作流一致性 / Maintain workflow consistency across tools |
| **Project** | 项目规范、架构决策、编码约定 / Specs, architecture decisions, conventions | 新项目快速初始化 / Quick context setup for new projects |
| **Feedback** | 用户纠正、工具使用反馈 / Corrections, tool usage feedback | 避免重复犯错，提升输出质量 / Avoid repeated mistakes |
| **Reference** | 参考资料、API 文档、链接 / References, API docs, links | 构建项目知识库 / Build project knowledge base |
| **Session** | 对话总结、临时上下文 / Conversation summaries, ephemeral context | 保留工作进度 / Preserve work progress |

## 💡 典型迁移场景 / Migration Scenarios

<details open>
<summary><strong>🇨🇳 中文场景</strong></summary>

### 场景 A: OpenClaw → Claude Code（记忆迁移）

```
OpenClaw 已积累:
  ├── 150+ 条 user 记忆（个人偏好）
  ├── 80+ 条 project 记忆（项目规范）
  └── 200+ 条 feedback 记忆（纠正记录）

迁移到 Claude Code 后:
  ✅ 首次对话即理解项目架构
  ✅ 自动遵循编码约定
  ✅ 避免已知陷阱和错误
```

### 场景 B: Claude Code → OpenClaw（技能迁移）

```
Claude Code 已安装技能:
  ├── react-best-practices (12 files)
  ├── postgres-best-practices (8 files)
  └── bug-hunter (5 files)

迁移到 OpenClaw 后:
  ✅ 快速恢复开发能力
  ✅ 无需重新搜索和安装
  ✅ 技能配置零丢失
```

</details>

<details>
<summary><strong>🇬🇧 English Scenarios</strong></summary>

### Scenario A: OpenClaw → Claude Code (Memory Migration)

```
OpenClaw has accumulated:
  ├── 150+ user memories (preferences)
  ├── 80+ project memories (specs)
  └── 200+ feedback memories (corrections)

After migration to Claude Code:
  ✅ Understands project architecture on first prompt
  ✅ Follows coding conventions automatically
  ✅ Avoids known pitfalls and errors
```

### Scenario B: Claude Code → OpenClaw (Skill Migration)

```
Claude Code has installed skills:
  ├── react-best-practices (12 files)
  ├── postgres-best-practices (8 files)
  └── bug-hunter (5 files)

After migration to OpenClaw:
  ✅ Quickly restore development capability
  ✅ No need to re-search and install
  ✅ Zero-loss skill configuration
```

</details>

## 🛡️ 安全机制 / Safety

| 机制 / Mechanism | 说明 / Description |
|-----------------|-------------------|
| **自动备份** Auto Backup | 迁移前自动备份到 `skills.backup.{timestamp}/` |
| **冲突检测** Conflict Detection | 检测已存在文件，避免覆盖 / Detect existing files, prevent overwrites |
| **独立存储** Isolated Storage | 中间 `memory-store/` 不直接修改源文件 |
| **选择性迁移** Selective Migration | 逐条勾选，精确控制 / Per-item selection, precise control |

## 📁 项目结构 / Project Structure

```
ai-memory-router/
├── src/                    # 后端 / Backend
│   ├── adapters/           # 工具适配器 / Tool adapters (16 source, 14 target)
│   ├── server.ts           # Hono HTTP 服务器 / HTTP server
│   ├── scanner.ts          # 记忆扫描器 / Memory scanner
│   ├── skills-scanner.ts   # 技能扫描器 / Skills scanner
│   ├── writer.ts           # 写入中间存储 / Writer
│   ├── reader.ts           # 读取完整条目 / Reader
│   ├── migrate.ts          # 迁移执行器 / Migration executor
│   ├── port.ts             # 端口管理 / Port management
│   ├── logger.ts           # 日志模块 / Logger
│   ├── types.ts            # 类型定义 / Type definitions
│   └── utils.ts            # 工具函数 / Utilities
├── public/                 # 前端 / Frontend
│   ├── index.html          # 页面结构 / Page structure
│   ├── styles.css          # 样式 / Styles (Frosted Glass)
│   └── app.js              # 交互逻辑 / Interaction logic
├── memory-store/           # 中间存储（自动生成）/ Intermediate storage
├── skills-store/           # 技能缓存（自动生成）/ Skills cache
└── package.json
```

## ⌨️ 技术栈 / Tech Stack

| 层级 / Layer | 技术 / Technology |
|-------------|-------------------|
| 后端 / Backend | Hono + @hono/node-server (TypeScript ESM) |
| 前端 / Frontend | 原生 HTML/CSS/JS (SPA) / Vanilla HTML/CSS/JS |
| 设计 / Design | Frosted Glass / CSS Custom Properties |
| API | RESTful JSON (`/api/memories`, `/api/skills`, `/api/migrate`) |
