# Skills 迁移重构方案

## 问题

Skills 不是文本记忆，是完整的文件系统目录：

```
~/.copilot/skills/some-skill/
├── SKILL.md              # 技能定义
├── references/           # 参考文档
│   └── api-guide.md
├── scripts/              # 可执行脚本
│   └── deploy.sh
├── package.json          # 依赖
└── assets/               # 资源文件
    └── template.html
```

提取 SKILL.md 内容存为 markdown 文件毫无意义——迁移过去后代码、脚本、依赖全部丢失。

## 重构方案：记忆和 skills 分离

### 两套独立存储

```
memory-store/           # 纯文本记忆 (已有)
├── user/
├── project/
├── feedback/
├── reference/
└── sessions/

skills-store/           # 技能目录 (新增)
├── index.json          # 索引: { id, source, name, description, path }
├── copilot/
│   ├── some-skill/     # 完整复制原始目录
│   └── another-skill/
├── cline/
│   └── find-skills/
└── continue/
    └── remotion-best-practices/
```

### Skills 迁移流程

```
扫描阶段:
  SourceAdapter.scanSkills() → 发现 skills 目录 → 完整复制到 skills-store/
  生成 index.json: [{ id, source, name, description, path, size }]

Web UI:
  独立的 "Skills" tab
  展示: 来源工具 badge | 技能名 | 描述 | 文件大小 | 包含文件数
  用户勾选要迁移的 skills

迁移阶段:
  将整个技能目录从 skills-store/ 复制到目标工具的 skills 目录
  不做任何格式转换，完整复制
```

### SourceAdapter 接口扩展

```typescript
interface SourceAdapter {
  // ... 已有方法
  scan(homeDir: string): MemoryEntry[];

  // 新增：扫描技能（返回目录路径列表，不是文本内容）
  scanSkillDirs?(homeDir: string): SkillInfo[];
}

interface SkillInfo {
  id: string;           // sourceTool + skillName
  sourceTool: ToolId;
  name: string;         // 目录名
  description: string;  // 从 SKILL.md 第一行提取
  dirPath: string;      // 完整目录路径
  size: number;         // 目录总大小(bytes)
  fileCount: number;    // 文件数量
}
```

### TargetAdapter 接口扩展

```typescript
interface TargetAdapter {
  // ... 已有方法
  write(entries: MemoryEntry[], basePath: string): MigrationResult;

  // 新增：写入技能目录
  writeSkillDirs?(skills: SkillDir[], basePath: string): MigrationResult;
}

interface SkillDir {
  sourceDir: string;    // skills-store/ 中的目录路径
  name: string;         // 技能名
}
```

### 哪些工具有 skills？

| 工具 | Skills 路径 | 是否完整目录 |
|------|------------|-------------|
| Copilot | `~/.copilot/skills/*/` | 是 |
| Cline | `~/.cline/skills/` (symlinks) | 是（符号链接） |
| Continue | `~/.continue/skills/*/` | 是 |
| Claude Code | `~/.claude/skills/*/` | 是 |
| Cursor | `~/.cursor/rules/` | 否（仅 .md） |
| Hermes | N/A | 不适用 |
| OpenClaw | `~/.openclaw/workspace/*.py` | 否（脚本非 skills） |

### 迁移策略

- **目录级复制**：`fs.cp(sourceDir, targetDir, { recursive: true })`
- **符号链接处理**：Cline 的 skills 是符号链接，需要解析后完整复制
- **依赖检查**：迁移后提示用户运行 `npm install`（如果有 package.json）
- **权限保留**：保留脚本执行权限
