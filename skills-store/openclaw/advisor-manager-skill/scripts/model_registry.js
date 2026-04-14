const { ModelConfigurationError } = require("./model_configuration_error");

class ModelRegistry {
  constructor(candidateModels = [], openclawConfig = []) {
    this.candidateModels = Array.isArray(candidateModels) ? candidateModels.map((model) => ({ ...model })) : [];
    if (Array.isArray(openclawConfig)) {
      this.openclawConfiguredModels = openclawConfig.map((model) => ({ ...model }));
      this.openclawConfiguredProviders = {};
    } else {
      this.openclawConfiguredModels = Array.isArray(openclawConfig.models)
        ? openclawConfig.models.map((model) => ({ ...model }))
        : [];
      this.openclawConfiguredProviders = openclawConfig.providers || {};
    }
  }

  parseCandidateIdentifier(candidate = {}) {
    const alias = candidate.alias || null;
    if (candidate.provider && candidate.model) {
      return {
        alias,
        provider: candidate.provider,
        model: candidate.model,
        canonicalId: `${candidate.provider}/${candidate.model}`
      };
    }

    if (typeof candidate.model === "string" && candidate.model.includes("/")) {
      const slashIndex = candidate.model.indexOf("/");
      return {
        alias,
        provider: candidate.model.slice(0, slashIndex),
        model: candidate.model.slice(slashIndex + 1),
        canonicalId: candidate.model
      };
    }

    return {
      alias,
      provider: candidate.provider || null,
      model: candidate.model || null,
      canonicalId: null
    };
  }

  findConfiguredModel(candidate = {}) {
    const parsedCandidate = this.parseCandidateIdentifier(candidate);
    return this.openclawConfiguredModels.find((configuredModel) => {
      const sameAlias = configuredModel.alias && parsedCandidate.alias && configuredModel.alias === parsedCandidate.alias;
      const sameCanonicalId = configuredModel.canonicalId && parsedCandidate.canonicalId && configuredModel.canonicalId === parsedCandidate.canonicalId;
      const sameProviderModel = configuredModel.provider === parsedCandidate.provider && configuredModel.model === parsedCandidate.model;
      return sameAlias || sameCanonicalId || sameProviderModel;
    }) || null;
  }

  findConfiguredProvider(candidate = {}) {
    const parsedCandidate = this.parseCandidateIdentifier(candidate);
    return parsedCandidate.provider ? (this.openclawConfiguredProviders[parsedCandidate.provider] || null) : null;
  }

  validateCandidateCount() {
    if (this.candidateModels.length !== 2) {
      throw new ModelConfigurationError(
        `Advisor Claw Skill requires exactly 2 models, but received ${this.candidateModels.length}. Please configure exactly 2 models before using this skill.`,
        {
          requiredCount: 2,
          receivedCount: this.candidateModels.length
        }
      );
    }
  }

  resolveCandidateModel(candidate = {}) {
    const configuredModel = this.findConfiguredModel(candidate);
    if (configuredModel) {
      return {
        ...configuredModel,
        ...candidate,
        source: "openclaw-configured"
      };
    }

    const configuredProvider = this.findConfiguredProvider(candidate);
    if (configuredProvider) {
      const parsedCandidate = this.parseCandidateIdentifier(candidate);
      return {
        ...configuredProvider,
        ...candidate,
        provider: parsedCandidate.provider || candidate.provider,
        model: parsedCandidate.model || candidate.model,
        canonicalId: parsedCandidate.canonicalId || (parsedCandidate.provider && parsedCandidate.model
          ? `${parsedCandidate.provider}/${parsedCandidate.model}`
          : null),
        source: "openclaw-configured"
      };
    }

    if (!candidate.api_key_env && !candidate.apiKey) {
      throw new ModelConfigurationError(
        `Model \"${candidate.alias || candidate.model || "unknown-model"}\" is not configured in OpenClaw. Please provide an API key before using this skill.`,
        {
          alias: candidate.alias,
          model: candidate.model,
          provider: candidate.provider,
          actionRequired: "provide-api-key"
        }
      );
    }

    return {
      ...candidate,
      source: "external-api-key"
    };
  }

  normalize() {
    this.validateCandidateCount();
    return this.candidateModels.map((model) => {
      const resolvedModel = this.resolveCandidateModel(model);
      return ({
      ...resolvedModel,
      strength_score: Number.isFinite(resolvedModel.strength_score) ? resolvedModel.strength_score : 0.5,
      cost_score: Number.isFinite(resolvedModel.cost_score) ? resolvedModel.cost_score : 0.5,
      capabilities: Array.isArray(resolvedModel.capabilities) ? resolvedModel.capabilities : []
    });
    });
  }

  assignRoles() {
    const models = this.normalize();

    const advisor = [...models].sort((left, right) => right.strength_score - left.strength_score)[0];
    const executorCandidates = models.filter((model) => model.alias !== advisor.alias);
    const executor = executorCandidates.sort((left, right) => {
      const leftScore = (left.strength_score * 0.4) + (left.cost_score * 0.6);
      const rightScore = (right.strength_score * 0.4) + (right.cost_score * 0.6);
      return rightScore - leftScore;
    })[0];

    return {
      advisor,
      executor
    };
  }
}

module.exports = {
  ModelRegistry
};