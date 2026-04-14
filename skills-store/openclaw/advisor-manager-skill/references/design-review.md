# Advisor Manager 设计推演与纠偏记录

## 引用原始设计的保留部分

以下设计意图直接保留自 [Advisor Claw详细设计V1.md](d:\YunXue\advisor-claw\Advisor%20Claw详细设计V1.md)：

- 保留“低成本执行者 + 高智能顾问”的反向架构主张。
- 保留 `SKILL.md + config + scripts + templates + references` 的目录拆分。
- 保留 `AdvisorOrchestrator / DecisionEngine / CostTracker / ContextManager` 四个核心模块。
- 保留 `balanced / cost_saver / quality_first` 三种策略层级。

## Understanding Summary

- 要构建的是一个用于 OpenClaw 的 advisor-manager skill，而不是单一厂商的 API demo。
- 目标是把大多数任务留给低成本执行模型，仅在复杂、卡住或高风险节点上调用顾问模型。
- 设计必须兼顾成本、质量、可解释性和后续接线可行性。
- 需要可落盘的 skill 目录，而不是停留在概念说明。
- 需要对原始方案做系统性推演和修正，而不是局部润色。
- 非目标是现在就把所有第三方 SDK 和网关配置接到真实线上环境。

## Assumptions

- OpenClaw 可以消费 `SKILL.md` 和分离的配置/脚本目录。
- 真实 provider 接线细节未来会由适配器层补齐。
- 当前阶段更重要的是结构正确、职责边界清晰、可验证，而不是立即联网运行。
- Windows 是首要落盘和校验环境。

## 20 轮推演与修正

| 轮次 | 审查焦点 | 原方案问题 | 修正动作 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 范围边界 | 原方案把 Anthropic advisor 示例直接当作 OpenClaw 顶层契约 | 将 provider 特定 header 下沉到适配器层 | skill 不再被单厂商绑定 |
| 2 | 模型标识 | `claude-opus-4-6` 等版本名过于未来态且脆弱 | 改为稳定别名 + 配置化 model 字段 | 降低未来升级成本 |
| 3 | 目录职责 | 原目录缺少验证入口 | 增加 `README.md` 与 `smoke_test.js` | 能快速做本地校验 |
| 4 | 配置演进 | YAML 无 schema 版本 | 全部配置加入 `schema_version` | 为后续迁移留入口 |
| 5 | 策略表达 | 单一复杂度阈值过于粗糙 | 改为多信号加权决策 | 调用顾问更可解释 |
| 6 | 复杂度来源 | 原方案假设 `task.getComplexity()` 已可靠存在 | 增加由 task 字段推导的 complexity/uncertainty/stagnation 信号 | 降低调用方负担 |
| 7 | 过度升级 | 每 5 次迭代强制升级过于机械 | 使用 cooldown + stagnation 联合判断 | 避免无意义 advisor 调用 |
| 8 | 预算纪律 | 没有为最终审查预留预算 | 引入 `reserve_for_final_review_usd` | 防止中途花光预算 |
| 9 | 成本模型 | `CostTracker` 写死角色价格 | 改为价格卡驱动 | 支持多模型扩展 |
| 10 | 顾问冷却 | 连续两轮都可能升级 | 增加 `cooldown_iterations` | 降低颤振 |
| 11 | 上下文泄露 | 原方案未定义脱敏规则 | `ContextManager` 增加 redaction key 列表 | 降低秘钥暴露风险 |
| 12 | 上下文体积 | 没有限制 advisor brief 规模 | 增加摘要和 recent events 上限 | 降低 token 成本 |
| 13 | 提示合同 | 原方案没有模板化 prompt 契约 | 新增三类模板：初始规划、中途指导、终局质检 | 输出更稳定 |
| 14 | 回退策略 | provider 异常时没有降级路径 | 新增 executor/advisor fallback order | 提升韧性 |
| 15 | 工具权限 | `SKILL.md` 默认开放过多工具 | 删去非必需权限，保留最小集合 | 减少 blast radius |
| 16 | 可观测性 | 原方案仅有日报概念，没有执行级轨迹 | 在输出中保留 `decisionTrail` 和 `warnings` | 单次会话可审计 |
| 17 | 可测试性 | 无法证明当前脚本结构是否可跑 | 新增 `smoke_test.js` 构造模拟任务 | 校验主路径语义 |
| 18 | 平台适配 | 安装示例偏 Bash，忽略 Windows | README 改为 Windows 友好的 `node` 命令校验 | 与当前环境一致 |
| 19 | 输出确定性 | 原方案结果对象未完全约束 | 在 `SKILL.md` 固定 JSON 输出契约 | 更适合网关与日志消费 |
| 20 | 反过度设计 | 继续添加真实 SDK 接线会把范围拉大 | 明确当前交付为“生产导向 scaffold” | 在当前需求下达到最优复杂度 |

## Final Architecture

最终架构保留原设计骨架，但把不稳定、不可验证、缺少边界的部分全部收紧：

1. `SKILL.md` 只定义技能职责、触发条件、最小工具权限和结果契约。
2. `config/` 只放声明式策略、预算、角色和脱敏规则，不混入运行态状态。
3. `scripts/` 负责纯 orchestration 逻辑，其中 provider 调用被隔离为一个独立客户端。
4. `templates/` 作为 advisor prompt 的稳定接口，避免逻辑层硬编码提示词。
5. `references/` 保留此次 20 轮推演与决策日志，便于后续审阅。

## Decision Log

1. 继续采用原文的“执行者优先、顾问兜底”总架构。
2. 不把 Anthropic beta headers 写进顶层技能描述。
3. 角色配置使用稳定 alias，不锁死未来版本号。
4. 决策引擎从阈值型改为加权评分型。
5. 预算控制引入 soft/hard limit 和 final review reserve。
6. 上下文管理必须包含脱敏和裁剪。
7. OpenClaw 工具权限遵循最小授权原则。
8. 当前阶段交付真实可运行 scaffold，而非所有 provider 的最终联网实现。
9. 验证优先级高于继续扩展功能面。
10. 到第 20 轮后，继续优化只会进入推测性设计，收益开始下降，因此停止扩展。

## 退出结论

在当前约束下，已没有“必须现在继续改”的关键细节。剩余可做项只属于接线工程或未来版本增强，不属于本轮设计优化遗漏。

## 新需求对照下的 Brainstorming 推演

以下推演针对新增的四条运行要求进行二次审查，目标是先找漏洞，再把漏洞落地修复。

| 轮次 | 新审查焦点 | 暴露出的漏洞 | 修正动作 | 结果 |
| --- | --- | --- | --- | --- |
| 21 | 安装后配置方式 | 现有设计只能从静态 YAML 启动，不能表达“先安装后通过对话配置模型” | 在技能文档中明确 candidate model workflow，并新增 `model_catalog.example.yaml` | 用户配置路径被显式化 |
| 22 | 模型来源 | 原结构只覆盖内置配置模型，没有外部 API-key 模型入口 | 增加 `source: openclaw-configured/external-api-key` 元数据 | 内外模型源统一 |
| 23 | 角色分配 | 原结构把 advisor/executor 写死在 roles.yaml | 引入按 strength/cost 自动分角的 `ModelRegistry` | 角色能按模型强度自动推导 |
| 24 | 强度定义 | 原方案没有统一强度度量 | 在模型目录中加入 `strength_score` 和 `cost_score` | 可解释分配成为可能 |
| 25 | 运行过程记录 | 之前只有 JSON 输出，没有过程级落盘日志 | 新增 `ExecutionLogger`，固定写入 `out/*.md` | 运行轨迹可追踪 |
| 26 | 日志内容 | 原事件记录没有“模型执行了什么命令”的视角 | 日志中记录时间、角色、模型、命令、结果或异常 | 满足审计要求 |
| 27 | 异常恢复策略 | 原编排只有 warnings，没有正式恢复链 | 新增固定 5 轮修复策略：executor 3 次，advisor 2 次 | 恢复路径明确 |
| 28 | 异常责任切换 | 原方案没有从 executor 升级到 advisor 的硬规则 | 新增 `repairFailure` 分派逻辑 | 升级链具备确定性 |
| 29 | 异常终止 | 之前失败只会冒普通异常，没有结构化原因和堆栈 | 新增 `AdvisorRuntimeError`，包含 attempts、cause、stack | 用户能看清无法修复原因 |
| 30 | 回归验证 | 原 smoke test 不覆盖新能力 | 扩展 smoke test 覆盖自动分角、日志落盘、异常升级链 | 新结构可验证 |
| 31 | 自动检测真实性 | 之前的“已配置模型检测”仍靠调用方传参，不是真自动发现 | 新增 `OpenClawConfigLoader` 读取常见 OpenClaw 配置路径 | 自动发现进入真实代码路径 |
| 32 | 配置格式兼容 | OpenClaw 配置可能是 YAML 或 JSON，且存在不同嵌套层级 | 加入 YAML 解析和多种结构提取规则 | 自动检测更稳健 |
| 33 | 入口示例可信度 | 运行入口只用硬编码配置，不足以证明自动检测工作 | `index.js` 先尝试真实发现，再 fallback 到 demo 配置 | 示例与真实能力一致 |
| 34 | 检测回归 | 原 smoke test 未验证配置文件发现逻辑 | 增加临时 YAML 配置文件加载测试 | 检测能力有可执行证据 |
| 35 | 官方格式偏差 | 之前的 loader 仍在围绕 YAML/通用结构兜圈子，不符合 OpenClaw 官方主格式 | 改为优先解析 `~/.openclaw/openclaw.json` 的 JSON5 | 与官方格式一致 |
| 36 | 配置合并语义 | OpenClaw 支持项目级 `openclaw.config.json` 覆盖全局配置，之前未实现 | loader 增加全局配置 + 项目配置合并 | 与真实运行路径一致 |
| 37 | `$include` 支持 | 官方文档支持 JSON5 `$include`，之前无法解析 | loader 增加边界内 include 展开与循环检测 | 支持真实配置拆分方式 |
| 38 | 模型检测字段 | 真实配置里的模型定义分散在 `models.providers`、`agents.defaults.models`、`agents.defaults.model`、`agents.list[].model` | 改为按这些官方字段提取模型与 provider 配置 | 检测结果与 OpenClaw 配置语义对齐 |

## 新一轮 Decision Log

11. 用户对话配置模型的能力先通过候选模型目录和运行入口表达，后续再接 OpenClaw 交互层。
12. 角色分配由模型强度主导，成本作为 executor 选择的二级信号。
13. 详细执行过程必须持久化到 Markdown，而不是只留内存事件。
14. 异常恢复策略固定为 executor 3 次 + advisor 2 次，避免无限重试。
15. 最终抛出的运行时异常必须包含原因解释和程序堆栈。