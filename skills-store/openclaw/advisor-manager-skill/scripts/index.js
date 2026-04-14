const { AdvisorOrchestrator } = require("./advisor_orchestrator");
const { ProviderClient } = require("./provider_client");
const { OpenClawConfigLoader } = require("./openclaw_config_loader");

async function main() {
  const defaultConfig = {
    runtime: {
      default_strategy: "balanced",
      max_iterations: 12,
      dry_run: false
    },
    budget: {
      soft_limit_usd: 3,
      hard_limit_usd: 5,
      reserve_for_final_review_usd: 0.75
    },
    advisor: {
      cooldown_iterations: 2,
      min_signal_score: 0.70,
      critical_signal_score: 0.85,
      max_calls_per_session: 4,
      initial_review_policy: "complex-or-high-risk",
      completion_review_policy: "if-budget-reserved"
    },
    context: {
      max_summary_chars: 4000,
      max_recent_events: 8,
      redact_keys: ["api_key", "password", "secret", "token"]
    },
    roles: {
      auto_assign_by_strength: true
    },
    telemetry: {
      output_dir: "out"
    },
    recovery: {
      total_attempts: 5,
      executor_attempts_before_escalation: 3,
      advisor_attempts_after_escalation: 2,
      include_stack_trace: true
    }
  };

  // 混合模式: step-3.5-flash (执行者, 零成本) + deepseek-coder (顾问, 强编码/分析)
  const candidateModels = [
    {
      alias: "step-3.5-flash",
      provider: "stepfun",
      model: "step-3.5-flash",
      strength_score: 0.72,
      cost_score: 0.98,
      capabilities: ["tool_calling", "fast_iteration", "vision", "long_context"]
    },
    {
      alias: "deepseek-coder",
      provider: "deepseek",
      model: "deepseek-coder",
      strength_score: 0.88,
      cost_score: 0.90,
      capabilities: ["strategic_planning", "complex_problem_solving", "quality_review", "advanced_analysis"]
    }
  ];

  // 加载 OpenClaw 配置
  const discoveredConfig = new OpenClawConfigLoader().load();
  const openclawConfig = discoveredConfig.models.length > 0 || Object.keys(discoveredConfig.providers || {}).length > 0
    ? discoveredConfig
    : { models: [], providers: {} };

  // 调查报告任务
  const task = {
    id: "ai-global-economy-2025-2026-report",
    title: "AI在2025-2026年全球经济中的影响调查报告",
    description: `生成一份详尽的调查报告，分析人工智能在2025-2026年期间对全球经济的影响。

报告应涵盖以下方面：

1. **宏观经济影响**: AI对全球GDP增长的贡献、生产力提升数据
2. **行业变革**: 金融、医疗、制造、零售、教育等行业的AI应用深度
3. **劳动力市场**: 就业结构变化、技能需求转型、AI替代与创造就业的平衡
4. **投资与融资**: 全球AI投资趋势、主要投资领域、估值变化
5. **地缘经济格局**: 中美欧AI竞赛、技术主权、监管差异
6. **成本与效率**: 企业AI部署成本变化、ROI数据、中小企业渗透率
7. **风险与挑战**: AI安全风险、数据隐私、伦理问题、监管合规
8. **未来展望**: 2027-2030年趋势预测、关键技术突破预期

要求：数据有据可查、分析客观深入、结构清晰、语言专业。`,
    estimatedSteps: 8,
    complexity: 0.85,
    risk: 0.5,
    uncertainty: 0.6,
    constraints: ["报告需结构完整", "数据需有据可查", "语言为中文"],
    successCriteria: ["生成完整的调查报告", "涵盖所有8个方面", "结构清晰专业"]
  };

  const providerClient = new ProviderClient();

  const orchestrator = new AdvisorOrchestrator({
    defaultConfig,
    roles: { roles: { executors: {}, advisors: {} } },
    strategies: {
      strategies: {
        balanced: {
          weights: {
            task_complexity: 0.35,
            execution_failures: 0.25,
            uncertainty: 0.20,
            budget_headroom: 0.10,
            stagnation: 0.10
          },
          thresholds: {
            summon_advisor: 0.70,
            summon_advisor_critical: 0.85
          },
          policies: {
            enable_initial_review: true,
            enable_final_review: true
          }
        }
      }
    },
    candidateModels,
    openclawConfig,
    providerClient
  });

  process.stderr.write("🧠 Advisor Manager 启动 - 混合模式\n");
  process.stderr.write(`   执行者: step-3.5-flash (零成本, 高速)\n`);
  process.stderr.write(`   顾问: deepseek-coder (强分析)\n`);
  process.stderr.write(`   任务: ${task.title}\n`);
  process.stderr.write("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const result = await orchestrator.processTask(task, { strategy: "balanced" });

  process.stderr.write("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.stderr.write(`✅ 任务完成: ${result.status}\n`);
  process.stderr.write(`📊 顾问调用: ${result.advisorCalls} 次\n`);
  process.stderr.write(`💰 总成本: $${result.cost.totalUsd.toFixed(6)}\n`);
  process.stderr.write(`📄 执行日志: ${result.logFile}\n`);
  if (result.reportFile) {
    process.stderr.write(`📋 完整报告: ${result.reportFile}\n`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`❌ 错误: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
