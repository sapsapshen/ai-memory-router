const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { AdvisorOrchestrator } = require("./advisor_orchestrator");
const { AdvisorRuntimeError } = require("./runtime_error");
const { ModelRegistry } = require("./model_registry");
const { ModelConfigurationError } = require("./model_configuration_error");
const { OpenClawConfigLoader } = require("./openclaw_config_loader");

async function run() {
  const tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "advisor-claw-"));
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), "advisor-claw-project-"));
  const tempConfigPath = path.join(tempConfigDir, "openclaw.json");
  const tempIncludePath = path.join(tempConfigDir, "providers.json5");
  const tempProjectConfigPath = path.join(tempProjectDir, "openclaw.config.json");

  fs.writeFileSync(tempIncludePath, `{
    models: {
      providers: {
        stub: {
          apiKey: "\${STUB_API_KEY}",
          models: [
            { id: "executor-stub-auto", name: "Executor Stub" },
            { id: "config-only-model", name: "Config Only Model" },
          ],
        },
      },
    },
  }`, "utf8");

  fs.writeFileSync(tempConfigPath, `{
    // Official OpenClaw JSON5 config
    $include: "./providers.json5",
    agents: {
      defaults: {
        models: {
          "stub/executor-stub-auto": { alias: "executor-stub-auto" },
          "stub/advisor-stub-auto": { alias: "advisor-stub-auto" },
        },
        model: {
          primary: "stub/advisor-stub-auto",
          fallbacks: ["stub/executor-stub-auto"],
        },
      },
    },
  }`, "utf8");

  fs.writeFileSync(tempProjectConfigPath, `{
    agents: {
      list: [
        {
          id: "project",
          model: { primary: "stub/project-model" },
        },
      ],
    },
    models: {
      providers: {
        stub: {
          models: [
            { id: "project-model", name: "Project Model" },
          ],
        },
      },
    },
  }`, "utf8");

  const loadedConfig = new OpenClawConfigLoader({
    configPath: tempConfigPath,
    projectConfigPath: tempProjectConfigPath,
    cwd: tempProjectDir
  }).load();
  assert.strictEqual(loadedConfig.sourcePath, tempConfigPath);
  assert.strictEqual(loadedConfig.sourcePaths.length, 2);
  assert.ok(loadedConfig.models.some((model) => model.alias === "executor-stub-auto"));
  assert.ok(loadedConfig.models.some((model) => model.canonicalId === "stub/project-model"));
  assert.ok(loadedConfig.providers.stub);
  assert.strictEqual(loadedConfig.providers.stub.api_key_env, "STUB_API_KEY");

  const registry = {
    stub: (roleConfig, payload) => {
      if (payload.purpose === "executor-pass" && payload.iteration === 2) {
        throw new Error(`executor failed at iteration ${payload.iteration}`);
      }

      if (payload.purpose === "repair-failure") {
        return {
          role: roleConfig.alias,
          provider: roleConfig.provider,
          purpose: payload.purpose,
          content: `repair success by ${roleConfig.alias}`,
          usage: {
            inputTokens: 50,
            outputTokens: 25
          }
        };
      }

      return {
        role: roleConfig.alias,
        provider: roleConfig.provider,
        purpose: payload.purpose,
        content: `success by ${roleConfig.alias}`,
        usage: {
          inputTokens: 100,
          outputTokens: 50
        }
      };
    }
  };

  const orchestrator = new AdvisorOrchestrator({
    defaultConfig: {
      runtime: {
        default_strategy: "balanced",
        max_iterations: 6
      },
      budget: {
        soft_limit_usd: 3,
        hard_limit_usd: 5,
        reserve_for_final_review_usd: 0.75
      },
      advisor: {
        cooldown_iterations: 1,
        max_calls_per_session: 4
      },
      context: {
        max_summary_chars: 4000,
        max_recent_events: 8,
        redact_keys: ["api_key", "secret", "password", "token"]
      },
      roles: {
        auto_assign_by_strength: true
      },
      telemetry: {
        output_dir: "out"
      },
      recovery: {
        executor_attempts_before_escalation: 3,
        advisor_attempts_after_escalation: 2,
        include_stack_trace: true
      }
    },
    roles: {
      roles: {
        executors: {
          primary: {
            alias: "executor-stub",
            provider: "stub",
            cost_per_million_tokens: { input_usd: 1, output_usd: 1 }
          }
        },
        advisors: {
          primary: {
            alias: "advisor-stub",
            provider: "stub",
            cost_per_million_tokens: { input_usd: 2, output_usd: 2 }
          }
        }
      }
    },
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
    candidateModels: [
      {
        alias: "executor-stub-auto",
        provider: "stub",
        model: "executor-stub-auto",
        strength_score: 0.60,
        cost_score: 0.95,
        capabilities: ["tool_calling", "fast_iteration"]
      },
      {
        alias: "advisor-stub-auto",
        provider: "stub",
        model: "advisor-stub-auto",
        api_key_env: "ADVISOR_STUB_API_KEY",
        strength_score: 0.96,
        cost_score: 0.20,
        capabilities: ["strategic_planning", "quality_review"]
      }
    ],
    openclawConfig: loadedConfig,
    providerClient: {
      invoke: async (roleConfig, payload) => registry.stub(roleConfig, payload)
    }
  });

  const result = await orchestrator.processTask({
    id: "smoke-test-task",
    title: "Smoke test",
    description: "Validate orchestration skeleton",
    estimatedSteps: 3,
    complexity: 0.8,
    risk: 0.8,
    uncertainty: 0.7,
    constraints: ["budget aware"],
    successCriteria: ["complete within reserved budget"]
  }, {
    strategy: "balanced"
  });

  assert.strictEqual(result.taskId, "smoke-test-task");
  assert.ok(["completed", "partial"].includes(result.status));
  assert.ok(typeof result.advisorCalls === "number");
  assert.ok(result.cost.totalUsd >= 0);
  assert.ok(Array.isArray(result.decisionTrail));
  assert.strictEqual(result.roleAssignments.executor, "executor-stub-auto");
  assert.strictEqual(result.roleAssignments.advisor, "advisor-stub-auto");
  assert.ok(fs.existsSync(result.logFile));

  const logContents = fs.readFileSync(result.logFile, "utf8");
  assert.ok(logContents.includes("Command: executor-pass"));
  assert.ok(logContents.includes("repair-failure:executor-pass"));
  assert.ok(logContents.includes("## Execution Quality vs Resource Comparison"));
  assert.ok(logContents.includes("Quality Score:"));
  assert.ok(logContents.includes("tokens"));
  assert.ok(logContents.includes("$"));

  const failingOrchestrator = new AdvisorOrchestrator({
    defaultConfig: {
      runtime: { default_strategy: "balanced", max_iterations: 2 },
      budget: { soft_limit_usd: 1, hard_limit_usd: 2, reserve_for_final_review_usd: 0.2 },
      advisor: { cooldown_iterations: 0, max_calls_per_session: 4 },
      context: { max_summary_chars: 1000, max_recent_events: 4, redact_keys: [] },
      roles: { auto_assign_by_strength: true },
      telemetry: { output_dir: "out" },
      recovery: { executor_attempts_before_escalation: 3, advisor_attempts_after_escalation: 2, include_stack_trace: true }
    },
    roles: orchestrator.roles,
    strategies: orchestrator.strategies,
    candidateModels: orchestrator.candidateModels,
    openclawConfig: orchestrator.openclawConfig,
    providerClient: {
      invoke: async (roleConfig, payload) => {
        throw new Error(`forced failure by ${roleConfig.alias} for ${payload.purpose}`);
      }
    }
  });

  let caught = null;
  try {
    await failingOrchestrator.processTask({
      id: "always-fail-task",
      title: "Always fail",
      description: "Validate runtime error escalation",
      estimatedSteps: 1,
      complexity: 0.8,
      risk: 0.8,
      uncertainty: 0.8
    }, { strategy: "balanced" });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof AdvisorRuntimeError);
  assert.ok(caught.message.includes("Unable to recover"));
  assert.ok(caught.stackTrace.includes("forced failure"));

  let countError = null;
  try {
    new ModelRegistry([
      { alias: "only-one", provider: "stub", model: "only-one" }
    ], []).assignRoles();
  } catch (error) {
    countError = error;
  }

  assert.ok(countError instanceof ModelConfigurationError);
  assert.ok(countError.message.includes("requires exactly 2 models"));

  let apiKeyError = null;
  try {
    new ModelRegistry([
      { alias: "configured-model", provider: "stub", model: "configured-model" },
      { alias: "missing-key-model", provider: "stub", model: "missing-key-model" }
    ], {
      models: [
        { alias: "configured-model", provider: "stub", model: "configured-model", canonicalId: "stub/configured-model", strength_score: 0.6, cost_score: 0.8 }
      ],
      providers: {}
    }).assignRoles();
  } catch (error) {
    apiKeyError = error;
  }

  assert.ok(apiKeyError instanceof ModelConfigurationError);
  assert.ok(apiKeyError.message.includes("Please provide an API key"));

  const providerConfiguredRoles = new ModelRegistry([
    { alias: "executor-provider-match", provider: "stub", model: "executor-provider-match", strength_score: 0.60, cost_score: 0.90 },
    { alias: "advisor-provider-match", provider: "stub", model: "advisor-provider-match", strength_score: 0.95, cost_score: 0.20 }
  ], {
    models: [],
    providers: {
      stub: {
        id: "stub",
        hasCredential: true,
        api_key_env: "STUB_API_KEY"
      }
    }
  }).assignRoles();

  assert.strictEqual(providerConfiguredRoles.executor.provider, "stub");
  assert.strictEqual(providerConfiguredRoles.advisor.provider, "stub");

  fs.rmSync(tempConfigDir, { recursive: true, force: true });
  fs.rmSync(tempProjectDir, { recursive: true, force: true });

  process.stdout.write("smoke-test: ok\n");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});