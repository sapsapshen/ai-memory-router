const fs = require("fs");
const path = require("path");
const { CostTracker } = require("./cost_tracker");
const { DecisionEngine } = require("./decision_engine");
const { ContextManager } = require("./context_manager");
const { ProviderClient, SECTION_PLAN } = require("./provider_client");
const { ModelRegistry } = require("./model_registry");
const { ExecutionLogger } = require("./execution_logger");
const { AdvisorRuntimeError } = require("./runtime_error");

class AdvisorOrchestrator {
  constructor(config = {}) {
    this.runtimeConfig = config.defaultConfig || {};
    this.roles = config.roles || {};
    this.strategies = config.strategies || {};
    this.providerClient = config.providerClient || new ProviderClient();
    this.contextManager = new ContextManager(this.runtimeConfig);
    this.costTracker = new CostTracker(this.runtimeConfig);
    this.executionLogger = new ExecutionLogger(this.runtimeConfig);
    this.candidateModels = config.candidateModels || [];
    this.openclawConfig = config.openclawConfig || {
      models: config.openclawConfiguredModels || [],
      providers: config.openclawConfiguredProviders || {}
    };
  }

  getRole(kind, name) {
    return (((this.roles.roles || {})[kind] || {})[name]) || null;
  }

  async processTask(task = {}, options = {}) {
    const strategyName = options.strategy || (((this.runtimeConfig.runtime || {}).default_strategy) || "balanced");
    const strategyConfig = (this.strategies.strategies || {})[strategyName];

    if (!strategyConfig) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    const decisionEngine = new DecisionEngine(this.runtimeConfig, strategyConfig);
    const state = {
      iteration: 0,
      lastAdvisorIteration: -999,
      advisorCalls: 0,
      completedSteps: 0,
      progress: {},
      events: [],
      warnings: [],
      decisionTrail: [],
      recoveryAttempts: [],
      chapterContents: []
    };

    const totalSteps = Math.max(task.estimatedSteps || 3, 1);
    const roleAssignments = this.resolveRoleAssignments();
    const executorRole = roleAssignments.executor;
    const advisorRole = roleAssignments.advisor;
    const initialReviewEnabled = !!(((strategyConfig.policies || {}).enable_initial_review));
    const finalReviewEnabled = !!(((strategyConfig.policies || {}).enable_final_review));
    const logFile = this.executionLogger.start(task);
    let status = "partial";
    let qualityReview = null;
    let finalError = null;

    try {
      if (initialReviewEnabled && this.shouldStartWithAdvisor(task)) {
        try {
          await this.runAdvisorPass("initial_planning", task, state, advisorRole);
        } catch (error) {
          await this.recoverUnhandledFailure(task, state, "initial_planning", executorRole, advisorRole, error);
        }
      }

      while (state.completedSteps < totalSteps && state.iteration < ((this.runtimeConfig.runtime || {}).max_iterations || 12)) {
        state.iteration += 1;
        const executorPass = await this.executeWithRecovery({
          task,
          state,
          command: "executor-pass",
          primaryRole: executorRole,
          fallbackRole: advisorRole,
          action: async (roleConfig) => this.runExecutorPass(task, state, roleConfig)
        });
        state.completedSteps += executorPass.progressIncrement;
        state.progress = {
          completedSteps: state.completedSteps,
          totalSteps,
          latestExecutorNote: executorPass.content
        };

        // Collect chapter content
        const stepNum = state.completedSteps;
        const sectionInfo = SECTION_PLAN && SECTION_PLAN[stepNum - 1];
        state.chapterContents.push({
          step: stepNum,
          sectionTitle: sectionInfo ? sectionInfo.title : `第${stepNum}章`,
          content: executorPass.content || ""
        });

        state.events.push({
          type: "executor-pass",
          iteration: state.iteration,
          progressIncrement: executorPass.progressIncrement,
          remainingSteps: Math.max(totalSteps - state.completedSteps, 0)
        });

        const signals = this.buildSignals(task, state, totalSteps);
        const decision = decisionEngine.shouldCallAdvisor({
          iteration: state.iteration,
          lastAdvisorIteration: state.lastAdvisorIteration,
          advisorCalls: state.advisorCalls,
          signals
        });

        state.decisionTrail.push({
          iteration: state.iteration,
          decision: decision.reason,
          score: decision.score,
          signals: decision.normalized
        });

        if (decision.shouldCall && this.costTracker.canSpend(0, { preserveFinalReview: finalReviewEnabled })) {
          await this.runAdvisorPass("mid_task_guidance", task, state, advisorRole);
        }
      }

      if (finalReviewEnabled && this.costTracker.canSpend(0)) {
        try {
          qualityReview = await this.runAdvisorPass("quality_assurance", task, state, advisorRole);
        } catch (error) {
          qualityReview = await this.recoverUnhandledFailure(task, state, "quality_assurance", executorRole, advisorRole, error);
        }
      }

      status = state.completedSteps >= totalSteps ? "completed" : "partial";

      // Write final report from collected chapters
      const reportPath = this.writeFinalReport(task, state, qualityReview);

      return {
        taskId: task.id || "unnamed-task",
        strategy: strategyName,
        status,
        roleAssignments: {
          executor: executorRole.alias,
          advisor: advisorRole.alias
        },
        advisorCalls: state.advisorCalls,
        cost: this.costTracker.getSummary(),
        decisionTrail: state.decisionTrail,
        artifacts: qualityReview ? [qualityReview.content] : [],
        warnings: state.warnings,
        logFile,
        reportFile: reportPath
      };
    } catch (error) {
      status = "failed";
      finalError = error;
      throw error;
    } finally {
      const summary = this.buildExecutionSummary({
        state,
        totalSteps,
        status,
        qualityReview,
        error: finalError
      });
      this.executionLogger.finish(summary);
    }
  }

  buildExecutionSummary({ state, totalSteps, status, qualityReview, error }) {
    const cost = this.costTracker.getSummary();
    const completionRatio = totalSteps > 0 ? (state.completedSteps / totalSteps) : 0;
    const reviewCoverage = qualityReview ? "initial/mid/final coverage reached" : (state.advisorCalls > 0 ? "advisor engaged without final review" : "executor only");
    const qualityScoreRaw = (
      (completionRatio * 70) +
      (qualityReview ? 15 : Math.min(state.advisorCalls, 1) * 8) +
      Math.max(0, 10 - (state.warnings.length * 2)) +
      Math.max(0, 5 - state.recoveryAttempts.length)
    );
    const qualityScore = Math.max(0, Math.min(100, Math.round(qualityScoreRaw)));

    let qualityTier = "Needs Attention";
    if (qualityScore >= 85) {
      qualityTier = "Excellent";
    } else if (qualityScore >= 70) {
      qualityTier = "Good";
    }

    let efficiencyTier = "Spend Heavy";
    if (qualityScore >= 85 && cost.totalUsd <= 0.01) {
      efficiencyTier = "High Quality / Low Spend";
    } else if (qualityScore >= 70 && cost.totalUsd <= 0.01) {
      efficiencyTier = "Balanced";
    } else if (qualityScore >= 85) {
      efficiencyTier = "High Quality / Higher Spend";
    }

    return {
      status,
      qualityTier,
      efficiencyTier,
      qualityScore,
      completedSteps: state.completedSteps,
      totalSteps,
      advisorCalls: state.advisorCalls,
      recoveryAttempts: state.recoveryAttempts.length,
      warningCount: state.warnings.length,
      reviewCoverage,
      executorTokens: cost.tokens.executor.total,
      advisorTokens: cost.tokens.advisor.total,
      totalTokens: cost.tokens.total.combined,
      executorUsd: cost.executorUsd,
      advisorUsd: cost.advisorUsd,
      totalUsd: cost.totalUsd,
      completionAssessment: completionRatio >= 1 ? "target met within current execution loop" : "task ended before all estimated steps completed",
      reviewAssessment: qualityReview ? "final QA was executed before closeout" : "quality relies on intermediate guidance only",
      stabilityAssessment: state.recoveryAttempts.length === 0 ? "stable execution without repair" : `used ${state.recoveryAttempts.length} bounded recovery attempts`,
      overallAssessment: `${qualityTier}; total spend ${cost.totalUsd.toFixed(6)} USD for ${cost.tokens.total.combined} tokens`,
      failureReason: error ? error.message : null
    };
  }

  writeFinalReport(task, state, qualityReview) {
    const reportDir = path.resolve(process.cwd(), (this.runtimeConfig.telemetry || {}).output_dir || "out");
    fs.mkdirSync(reportDir, { recursive: true });
    const safeTaskId = String(task.id || "task").replace(/[^a-zA-Z0-9-_]/g, "-");
    const reportPath = path.join(reportDir, `${this.toTimestamp()}-${safeTaskId}-report.md`);

    const lines = [
      `# ${task.title || "调查报告"}`,
      "",
      `> 由 Advisor Manager 自动生成 | ${new Date().toISOString()}`,
      `> 执行者: ${state.chapterContents.length > 0 ? "step-3.5-flash" : "N/A"} | 顾问: deepseek-coder`,
      "",
      "---",
      ""
    ];

    // Add table of contents
    lines.push("## 目录\n");
    for (const chapter of state.chapterContents) {
      lines.push(`- [${chapter.sectionTitle}](#${chapter.sectionTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "")})`);
    }
    lines.push("", "---", "");

    // Add each chapter
    for (const chapter of state.chapterContents) {
      lines.push(`## ${chapter.sectionTitle}`, "", chapter.content, "", "---", "");
    }

    // Add quality review if available
    if (qualityReview && qualityReview.content) {
      lines.push("## 质量审查意见", "", qualityReview.content, "", "---", "");
    }

    // Add execution metadata
    const cost = this.costTracker.getSummary();
    lines.push(
      "## 执行元数据",
      "",
      `- 状态: ${state.completedSteps >= (task.estimatedSteps || 8) ? "✅ 完成" : "⚠️ 部分完成"}`,
      `- 章节数: ${state.chapterContents.length}`,
      `- 总 Token: ${cost.tokens.total.combined}`,
      `- 成本: $${cost.totalUsd.toFixed(6)}`,
      `- 顾问调用: ${state.advisorCalls} 次`,
      ""
    );

    fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
    process.stderr.write(`📄 报告已保存: ${reportPath}\n`);
    return reportPath;
  }

  toTimestamp(date = new Date()) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  resolveRoleAssignments() {
    const autoAssign = ((((this.runtimeConfig.roles || {}).auto_assign_by_strength) !== false));
    if (autoAssign && Array.isArray(this.candidateModels) && this.candidateModels.length >= 2) {
      return new ModelRegistry(this.candidateModels, this.openclawConfig).assignRoles();
    }

    return {
      executor: this.getRole("executors", "primary"),
      advisor: this.getRole("advisors", "primary")
    };
  }

  shouldStartWithAdvisor(task = {}) {
    const complexity = Number.isFinite(task.complexity) ? task.complexity : 0.5;
    const risk = Number.isFinite(task.risk) ? task.risk : 0.5;
    return complexity >= 0.75 || risk >= 0.75;
  }

  buildSignals(task, state, totalSteps) {
    const complexity = Number.isFinite(task.complexity) ? task.complexity : Math.min(totalSteps / 10, 1);
    const failures = Number.isFinite(task.failurePressure) ? task.failurePressure : Math.min(state.warnings.length / 3, 1);
    const uncertainty = Number.isFinite(task.uncertainty) ? task.uncertainty : (complexity * 0.6);
    const budgetHeadroom = this.costTracker.getBudgetRemainingUsd() > 0 ? 1 : 0;
    const stagnation = state.iteration > 0 ? Math.max((state.iteration - state.completedSteps) / Math.max(totalSteps, 1), 0) : 0;

    return {
      task_complexity: complexity,
      execution_failures: failures,
      uncertainty,
      budget_headroom: budgetHeadroom,
      stagnation
    };
  }

  async runExecutorPass(task, state, roleConfig) {
    const payload = {
      purpose: "executor-pass",
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      iteration: state.iteration,
      step: state.completedSteps + 1,
      estimatedSteps: task.estimatedSteps,
      constraints: task.constraints,
      successCriteria: task.successCriteria,
      advisorAdvice: state.latestAdvisorAdvice || null
    };
    const response = await this.providerClient.invoke(roleConfig, payload);
    this.costTracker.record("executor", response.usage, roleConfig.cost_per_million_tokens || {});
    state.lastExecutorContent = response.content;
    this.executionLogger.append({
      role: "executor",
      model: roleConfig.alias,
      command: payload.purpose,
      outcome: "success",
      details: `step=${payload.step}; iteration=${payload.iteration}`
    });

    return {
      ...response,
      progressIncrement: 1
    };
  }

  async runAdvisorPass(purpose, task, state, roleConfig) {
    const context = this.contextManager.buildAdvisorContext(task, {
      progress: state.progress,
      events: state.events,
      warnings: state.warnings,
      budget: this.costTracker.getSummary(),
      lastExecutorContent: state.lastExecutorContent || null
    });

    const response = await this.providerClient.invoke(roleConfig, {
      purpose,
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      constraints: task.constraints,
      successCriteria: task.successCriteria,
      progress: state.progress,
      advisorAdvice: state.latestAdvisorAdvice || null,
      context
    });

    this.costTracker.record("advisor", response.usage, roleConfig.cost_per_million_tokens || {});
    state.lastAdvisorIteration = state.iteration;
    state.advisorCalls += 1;
    state.latestAdvisorAdvice = response.content;
    state.events.push({
      type: "advisor-pass",
      purpose,
      iteration: state.iteration,
      role: roleConfig.alias
    });
    this.executionLogger.append({
      role: "advisor",
      model: roleConfig.alias,
      command: purpose,
      outcome: "success",
      details: `iteration=${state.iteration}`
    });

    return response;
  }

  async executeWithRecovery({ task, state, command, primaryRole, fallbackRole, action }) {
    const recoveryConfig = this.runtimeConfig.recovery || {};
    const maxPrimaryAttempts = recoveryConfig.executor_attempts_before_escalation || 3;
    const maxFallbackAttempts = recoveryConfig.advisor_attempts_after_escalation || 2;
    const attempts = [];

    for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt += 1) {
      try {
        return await action(primaryRole);
      } catch (error) {
        attempts.push(this.recordRecoveryFailure(state, primaryRole, command, attempt, error));
      }
    }

    for (let attempt = 1; attempt <= maxFallbackAttempts; attempt += 1) {
      try {
        return await this.repairFailure(task, state, fallbackRole, command, attempt);
      } catch (error) {
        attempts.push(this.recordRecoveryFailure(state, fallbackRole, command, maxPrimaryAttempts + attempt, error));
      }
    }

    const lastAttempt = attempts[attempts.length - 1] || {};
    throw new AdvisorRuntimeError(
      `Unable to recover from ${command} after ${attempts.length} attempts.`,
      {
        attempts,
        reason: `executor failed ${maxPrimaryAttempts} times and advisor failed ${maxFallbackAttempts} times`,
        causeError: lastAttempt.errorObject,
        stackTrace: lastAttempt.stack
      }
    );
  }

  recordRecoveryFailure(state, roleConfig, command, attemptNumber, error) {
    const attempt = {
      attemptNumber,
      role: roleConfig.alias,
      command,
      message: error.message,
      stack: error.stack,
      errorObject: error
    };
    state.recoveryAttempts.push(attempt);
    state.warnings.push(`${roleConfig.alias} failed ${command} on attempt ${attemptNumber}: ${error.message}`);
    this.executionLogger.append({
      role: this.getRoleType(roleConfig),
      model: roleConfig.alias,
      command,
      outcome: "failure",
      details: `attempt=${attemptNumber}`,
      error: error.stack || error.message
    });
    return attempt;
  }

  getRoleType(roleConfig) {
    const advisor = this.getRole("advisors", "primary");
    return advisor && advisor.alias === roleConfig.alias ? "advisor" : "executor";
  }

  async repairFailure(task, state, roleConfig, command, attempt) {
    const roleType = this.getRoleType(roleConfig);
    const response = await this.providerClient.invoke(roleConfig, {
      purpose: "repair-failure",
      failedCommand: command,
      taskId: task.id,
      iteration: state.iteration,
      attempt
    });
    this.costTracker.record(roleType, response.usage, roleConfig.cost_per_million_tokens || {});
    this.executionLogger.append({
      role: roleType,
      model: roleConfig.alias,
      command: `repair-failure:${command}`,
      outcome: "success",
      details: `attempt=${attempt}`
    });
    if (roleType === "advisor") {
      state.advisorCalls += 1;
      state.lastAdvisorIteration = state.iteration;
    }

    return {
      ...response,
      progressIncrement: 1,
      repairedBy: roleConfig.alias
    };
  }

  async recoverUnhandledFailure(task, state, command, executorRole, advisorRole, initialError) {
    this.executionLogger.append({
      role: "system",
      model: "orchestrator",
      command,
      outcome: "failure-detected",
      details: "Entering bounded recovery ladder",
      error: initialError.stack || initialError.message
    });

    const recoveryConfig = this.runtimeConfig.recovery || {};
    const attempts = [];
    const executorAttempts = recoveryConfig.executor_attempts_before_escalation || 3;
    const advisorAttempts = recoveryConfig.advisor_attempts_after_escalation || 2;

    for (let attempt = 1; attempt <= executorAttempts; attempt += 1) {
      try {
        return await this.repairFailure(task, state, executorRole, command, attempt);
      } catch (error) {
        attempts.push(this.recordRecoveryFailure(state, executorRole, command, attempt, error));
      }
    }

    for (let attempt = 1; attempt <= advisorAttempts; attempt += 1) {
      try {
        return await this.repairFailure(task, state, advisorRole, command, executorAttempts + attempt);
      } catch (error) {
        attempts.push(this.recordRecoveryFailure(state, advisorRole, command, executorAttempts + attempt, error));
      }
    }

    const lastAttempt = attempts[attempts.length - 1];
    throw new AdvisorRuntimeError(`Unable to recover from ${command} after ${attempts.length} attempts.`, {
      attempts,
      reason: `executor failed ${executorAttempts} recovery attempts and advisor failed ${advisorAttempts} recovery attempts`,
      causeError: lastAttempt ? lastAttempt.errorObject : initialError,
      stackTrace: lastAttempt ? lastAttempt.stack : initialError.stack
    });
  }
}

module.exports = {
  AdvisorOrchestrator
};