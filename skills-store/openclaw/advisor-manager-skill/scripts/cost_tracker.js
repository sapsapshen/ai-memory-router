function clampNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

class CostTracker {
  constructor(config = {}) {
    const budget = config.budget || {};
    this.softLimitUsd = clampNumber(budget.soft_limit_usd, 0);
    this.hardLimitUsd = clampNumber(budget.hard_limit_usd, 0);
    this.reserveForFinalReviewUsd = clampNumber(budget.reserve_for_final_review_usd, 0);
    this.usage = {
      executor: { usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 },
      advisor: { usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }
    };
  }

  static computeCost(usage = {}, priceCard = {}) {
    const inputTokens = clampNumber(usage.inputTokens, 0);
    const outputTokens = clampNumber(usage.outputTokens, 0);
    const inputUsd = clampNumber(priceCard.input_usd, 0);
    const outputUsd = clampNumber(priceCard.output_usd, 0);
    const usd = ((inputTokens * inputUsd) + (outputTokens * outputUsd)) / 1000000;

    return {
      usd,
      inputTokens,
      outputTokens
    };
  }

  record(role, usage, priceCard) {
    if (!this.usage[role]) {
      throw new Error(`Unknown role: ${role}`);
    }

    const computed = CostTracker.computeCost(usage, priceCard);
    this.usage[role].usd += computed.usd;
    this.usage[role].calls += 1;
    this.usage[role].inputTokens += computed.inputTokens;
    this.usage[role].outputTokens += computed.outputTokens;
    return computed;
  }

  getTotalUsd() {
    return this.usage.executor.usd + this.usage.advisor.usd;
  }

  getBudgetRemainingUsd() {
    return this.hardLimitUsd - this.getTotalUsd();
  }

  canSpend(additionalUsd = 0, options = {}) {
    const reserve = options.preserveFinalReview ? this.reserveForFinalReviewUsd : 0;
    return (this.getTotalUsd() + additionalUsd + reserve) <= this.hardLimitUsd;
  }

  hasSoftLimitRemaining() {
    return this.getTotalUsd() <= this.softLimitUsd;
  }

  getSummary() {
    const totalInputTokens = this.usage.executor.inputTokens + this.usage.advisor.inputTokens;
    const totalOutputTokens = this.usage.executor.outputTokens + this.usage.advisor.outputTokens;
    return {
      executorUsd: Number(this.usage.executor.usd.toFixed(6)),
      advisorUsd: Number(this.usage.advisor.usd.toFixed(6)),
      totalUsd: Number(this.getTotalUsd().toFixed(6)),
      budgetRemainingUsd: Number(this.getBudgetRemainingUsd().toFixed(6)),
      softLimitExceeded: !this.hasSoftLimitRemaining(),
      hardLimitExceeded: this.getTotalUsd() > this.hardLimitUsd,
      reserveForFinalReviewUsd: this.reserveForFinalReviewUsd,
      calls: {
        executor: this.usage.executor.calls,
        advisor: this.usage.advisor.calls
      },
      tokens: {
        executor: {
          input: this.usage.executor.inputTokens,
          output: this.usage.executor.outputTokens,
          total: this.usage.executor.inputTokens + this.usage.executor.outputTokens
        },
        advisor: {
          input: this.usage.advisor.inputTokens,
          output: this.usage.advisor.outputTokens,
          total: this.usage.advisor.inputTokens + this.usage.advisor.outputTokens
        },
        total: {
          input: totalInputTokens,
          output: totalOutputTokens,
          combined: totalInputTokens + totalOutputTokens
        }
      }
    };
  }
}

module.exports = {
  CostTracker
};