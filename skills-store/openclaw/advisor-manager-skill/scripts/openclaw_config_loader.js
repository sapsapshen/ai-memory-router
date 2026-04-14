const fs = require("fs");
const os = require("os");
const path = require("path");
const JSON5 = require("json5");

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class OpenClawConfigLoader {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.configPath = options.configPath || process.env.OPENCLAW_CONFIG_PATH || null;
    this.projectConfigPath = options.projectConfigPath || path.join(this.cwd, "openclaw.config.json");
    this.globalConfigPath = options.globalConfigPath || path.join(os.homedir(), ".openclaw", "openclaw.json");
  }

  resolveConfigPaths() {
    const sourcePaths = [];
    const primaryPath = this.configPath || this.globalConfigPath;

    if (primaryPath && fs.existsSync(primaryPath)) {
      sourcePaths.push(primaryPath);
    }

    if (this.projectConfigPath && fs.existsSync(this.projectConfigPath) && this.projectConfigPath !== primaryPath) {
      sourcePaths.push(this.projectConfigPath);
    }

    return sourcePaths;
  }

  parseFile(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON5.parse(raw);
  }

  ensureInsideRoot(resolvedPath, rootDir) {
    const normalizedRoot = path.resolve(rootDir);
    const normalizedTarget = path.resolve(resolvedPath);
    const relativePath = path.relative(normalizedRoot, normalizedTarget);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`Included config path must stay within ${normalizedRoot}: ${normalizedTarget}`);
    }

    return normalizedTarget;
  }

  deepMerge(baseValue, nextValue) {
    if (Array.isArray(baseValue) && Array.isArray(nextValue)) {
      return nextValue.slice();
    }

    if (isObject(baseValue) && isObject(nextValue)) {
      const merged = { ...baseValue };
      for (const [key, value] of Object.entries(nextValue)) {
        merged[key] = this.deepMerge(merged[key], value);
      }
      return merged;
    }

    return nextValue;
  }

  resolveInclude(includeSpec, currentDir, rootDir, seen) {
    const includePath = this.ensureInsideRoot(path.resolve(currentDir, includeSpec), rootDir);
    return this.loadResolvedFile(includePath, rootDir, seen);
  }

  resolveNode(node, currentDir, rootDir, seen) {
    if (Array.isArray(node)) {
      return node.map((item) => this.resolveNode(item, currentDir, rootDir, seen));
    }

    if (!isObject(node)) {
      return node;
    }

    if (Object.prototype.hasOwnProperty.call(node, "$include")) {
      const siblingEntries = { ...node };
      const includeSpec = siblingEntries.$include;
      delete siblingEntries.$include;

      let includedValue;
      if (Array.isArray(includeSpec)) {
        includedValue = includeSpec.reduce((accumulator, spec) => {
          const resolved = this.resolveInclude(spec, currentDir, rootDir, seen);
          return this.deepMerge(accumulator, resolved);
        }, {});
      } else {
        includedValue = this.resolveInclude(includeSpec, currentDir, rootDir, seen);
      }

      const resolvedSiblings = this.resolveNode(siblingEntries, currentDir, rootDir, seen);
      return this.deepMerge(includedValue, resolvedSiblings);
    }

    const resolvedObject = {};
    for (const [key, value] of Object.entries(node)) {
      resolvedObject[key] = this.resolveNode(value, currentDir, rootDir, seen);
    }
    return resolvedObject;
  }

  loadResolvedFile(filePath, rootDir, seen = new Set()) {
    const normalizedPath = path.resolve(filePath);
    if (seen.has(normalizedPath)) {
      throw new Error(`Circular config include detected: ${normalizedPath}`);
    }

    const nextSeen = new Set(seen);
    nextSeen.add(normalizedPath);
    const parsed = this.parseFile(normalizedPath);
    return this.resolveNode(parsed, path.dirname(normalizedPath), rootDir, nextSeen);
  }

  extractEnvName(value) {
    if (typeof value === "string") {
      const match = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
      return match ? match[1] : null;
    }

    if (isObject(value) && value.source === "env" && typeof value.id === "string") {
      return value.id;
    }

    return null;
  }

  extractConfiguredProviders(configRoot) {
    const providers = {};
    const providerNodes = (((configRoot.models || {}).providers) || {});

    for (const [providerId, providerConfig] of Object.entries(providerNodes)) {
      providers[providerId] = {
        id: providerId,
        api: providerConfig.api || null,
        baseUrl: providerConfig.baseUrl || null,
        api_key_env: this.extractEnvName(providerConfig.apiKey) || this.extractEnvName(providerConfig.token),
        hasCredential: Boolean(providerConfig.apiKey || providerConfig.token || providerConfig.auth || providerConfig.baseUrl),
        source: "openclaw-configured"
      };
    }

    return providers;
  }

  splitCanonicalModel(modelId) {
    if (typeof modelId !== "string" || !modelId.includes("/")) {
      return null;
    }

    const firstSlash = modelId.indexOf("/");
    return {
      provider: modelId.slice(0, firstSlash),
      model: modelId.slice(firstSlash + 1),
      canonicalId: modelId
    };
  }

  buildModelEntry(canonicalId, providerConfig = {}, extra = {}) {
    const split = this.splitCanonicalModel(canonicalId);
    if (!split) {
      return null;
    }

    return {
      alias: extra.alias || split.canonicalId,
      canonicalId: split.canonicalId,
      provider: split.provider,
      model: split.model,
      source: "openclaw-configured",
      api_key_env: providerConfig.api_key_env || null,
      provider_api: providerConfig.api || null,
      provider_base_url: providerConfig.baseUrl || null,
      strength_score: Number.isFinite(extra.strength_score) ? extra.strength_score : undefined,
      cost_score: Number.isFinite(extra.cost_score) ? extra.cost_score : undefined,
      capabilities: toArray(extra.capabilities)
    };
  }

  collectCanonicalModels(configRoot, configuredProviders) {
    const seen = new Map();

    const addEntry = (entry) => {
      if (!entry) {
        return;
      }

      const key = `${entry.canonicalId || `${entry.provider}/${entry.model}`}::${entry.alias}`;
      if (!seen.has(key)) {
        seen.set(key, entry);
      }
    };

    const defaultsModels = ((((configRoot.agents || {}).defaults || {}).models) || {});
    for (const [canonicalId, modelConfig] of Object.entries(defaultsModels)) {
      const split = this.splitCanonicalModel(canonicalId);
      const providerConfig = split ? (configuredProviders[split.provider] || {}) : {};
      addEntry(this.buildModelEntry(canonicalId, providerConfig, modelConfig));
    }

    const addModelReference = (reference) => {
      if (typeof reference !== "string") {
        return;
      }

      const split = this.splitCanonicalModel(reference);
      if (!split) {
        return;
      }

      addEntry(this.buildModelEntry(reference, configuredProviders[split.provider] || {}, {}));
    };

    const defaultsModelConfig = ((((configRoot.agents || {}).defaults || {}).model) || null);
    if (typeof defaultsModelConfig === "string") {
      addModelReference(defaultsModelConfig);
    } else if (isObject(defaultsModelConfig)) {
      addModelReference(defaultsModelConfig.primary);
      toArray(defaultsModelConfig.fallbacks).forEach(addModelReference);
    }

    toArray(((configRoot.agents || {}).list)).forEach((agentEntry) => {
      if (typeof agentEntry.model === "string") {
        addModelReference(agentEntry.model);
        return;
      }

      if (isObject(agentEntry.model)) {
        addModelReference(agentEntry.model.primary);
        toArray(agentEntry.model.fallbacks).forEach(addModelReference);
      }
    });

    const providerNodes = (((configRoot.models || {}).providers) || {});
    for (const [providerId, providerConfig] of Object.entries(providerNodes)) {
      toArray(providerConfig.models).forEach((modelEntry) => {
        const modelId = modelEntry.id || modelEntry.model || null;
        if (!modelId) {
          return;
        }

        addEntry(this.buildModelEntry(`${providerId}/${modelId}`, configuredProviders[providerId] || {}, {
          alias: modelEntry.alias || modelEntry.name || `${providerId}/${modelId}`
        }));
      });
    }

    return Array.from(seen.values());
  }

  load() {
    const resolvedPaths = this.resolveConfigPaths();
    if (resolvedPaths.length === 0) {
      return {
        sourcePath: null,
        sourcePaths: [],
        models: [],
        providers: {}
      };
    }

    let mergedConfig = {};
    resolvedPaths.forEach((resolvedPath) => {
      const rootDir = path.dirname(resolvedPath);
      const parsed = this.loadResolvedFile(resolvedPath, rootDir);
      mergedConfig = this.deepMerge(mergedConfig, parsed);
    });

    const configuredProviders = this.extractConfiguredProviders(mergedConfig);
    return {
      sourcePath: resolvedPaths[0],
      sourcePaths: resolvedPaths,
      models: this.collectCanonicalModels(mergedConfig, configuredProviders),
      providers: configuredProviders,
      rawConfig: mergedConfig
    };
  }
}

module.exports = {
  OpenClawConfigLoader
};