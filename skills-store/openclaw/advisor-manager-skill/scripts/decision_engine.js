function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

class DecisionEngine {
  constructor(runtimeConfig = {}, strategyConfig = {}) {
    this.runtimeConfig = runtimeConfig;
    this.strategyConfig = strategyConfig;
    this.cooldownIterations = (((runtimeConfig.advisor || {}).cooldown_iterations) || 0);
  }

  scoreSignals(signals = {}) {
    const weights = this.strategyConfig.weights || {};
    const normalized = {
      task_complexity: clamp01(signals.task_complexity),
      execution_failures: clamp01(signals.execution_failures),
      uncertainty: clamp01(signals.uncertainty),
      budget_headroom: clamp01(signals.budget_headroom),
      stagnation: clamp01(signals.stagnation)
    };

    const score = Object.keys(normalized).reduce((total, key) => {
      const weight = Number.isFinite(weights[key]) ? weights[key] : 0;
      return total + (normalized[key] * weight);
    }, 0);

    return {
      score: Number(score.toFixed(6)),
      normalized
    };
  }

  shouldCallAdvisor(state = {}) {
    const thresholds = this.strategyConfig.thresholds || {};
    const advisorConfig = this.runtimeConfig.advisor || {};
    const advisorCalls = state.advisorCalls || 0;
    const maxCalls = advisorConfig.max_calls_per_session || 0;

    if (maxCalls > 0 && advisorCalls >= maxCalls) {
      return {
        shouldCall: false,
        reason: "advisor-call-limit-reached",
        score: 0,
        normalized: {}
      };
    }

    if ((state.iteration - (state.lastAdvisorIteration || 0)) <= this.cooldownIterations) {
      return {
        shouldCall: false,
        reason: "advisor-cooldown-active",
        score: 0,
        normalized: {}
      };
    }

    const scored = this.scoreSignals(state.signals);
    const critical = scored.score >= (thresholds.summon_advisor_critical || 1);
    const normal = scored.score >= (thresholds.summon_advisor || 1);

    if (critical) {
      return {
        shouldCall: true,
        reason: "critical-signal-threshold",
        score: scored.score,
        normalized: scored.normalized
      };
    }

    if (normal) {
      return {
        shouldCall: true,
        reason: "signal-threshold",
        score: scored.score,
        normalized: scored.normalized
      };
    }

    return {
      shouldCall: false,
      reason: "executor-continues",
      score: scored.score,
      normalized: scored.normalized
    };
  }
}

module.exports = {
  DecisionEngine
};