---
name: daily-wechat-digest
description: 每日微信公众号摘要。定时抓取微信热词搜索文章，AI 总结后写入本地记忆，并同步关键洞察到飞书知识库。
---

# 每日微信公众号摘要技能

## 概述

每天定时执行两阶段工作流：
1. **09:00** - 获取微信热词 → 搜索文章 → AI 总结 → 保存摘要
2. **10:00** - 同步关键洞察到飞书知识库，按主题分类入库

## 工作目录

- 摘要输出：`memory/daily-wechat-digest/`
- 脚本目录：`scripts/fetch_wechat.py`

## 依赖技能

- `wechat-search-release` - 微信公众号搜索
- `feishu-knowledge-manager` - 飞书知识库同步

## 第一阶段：09:00 抓取与总结

### 执行逻辑

1. **获取热词**：从微信指数或热搜榜获取当日热词（若有 TikHub API Key）
2. **搜索文章**：对每个热词使用 `wechat-search` 搜索最新文章（限 3 个热词，每个 3 篇）
3. **AI 总结**：将文章标题 + 链接整理为 Markdown，摘要保存到 `memory/daily-wechat-digest/wechat-digest-YYYY-MM-DD.md`
4. **输出格式**：

```markdown
# 微信日报 YYYY-MM-DD

## 热词
- 热词1
- 热词2
- 热词3

## 文章列表

### 🔥 热词1 相关

1. [文章标题](链接) - 公众号名称
   > AI 摘要：...

2. ...

## 核心洞察
- 洞察1
- 洞察2
```

## 第二阶段：10:00 飞书同步

### 执行逻辑

1. 读取当日摘要 `memory/daily-wechat-digest/wechat-digest-YYYY-MM-DD.md`
2. 提取「核心洞察」和重要文章
3. 按主题分类同步到飞书各主题文档（参考 MEMORY.md 的主题分类）
4. 使用 `feishu-knowledge-manager` 技能的方法写入

## Cron 任务配置

| 任务 | ID | 时间 | 功能 |
|------|-----|------|------|
| 每日微信摘要 - 9点 | `8c5a6bdf-2433-4aa2-a904-6abafecb5f96` | `0 9 * * *` | 抓取+总结 |
| 每日微信摘要 - 飞书同步 - 10点 | `115e0ea4-e40f-40a8-a218-4901875fa236` | `0 10 * * *` | 飞书同步 |

## 使用方式

```bash
# 手动触发当日摘要
python scripts/fetch_wechat.py

# 查看当日摘要
type memory\daily-wechat-digest\wechat-digest-YYYY-MM-DD.md
```

## 热词来源

1. 微信搜一搜热词（）
2. 微博热搜（Fallback）
3. 知乎热榜（Fallback）

## 注意事项

- 搜索结果默认 5 篇/热词，可配置
- 尊重微信平台规范，不过度抓取
- 飞书同步只写 text block（block_type=2），避免 heading block 错误
