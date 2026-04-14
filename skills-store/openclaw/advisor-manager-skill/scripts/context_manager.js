class ContextManager {
  constructor(runtimeConfig = {}) {
    this.contextConfig = runtimeConfig.context || {};
    this.maxSummaryChars = this.contextConfig.max_summary_chars || 4000;
    this.maxRecentEvents = this.contextConfig.max_recent_events || 8;
    this.redactKeys = new Set((this.contextConfig.redact_keys || []).map((key) => String(key).toLowerCase()));
  }

  sanitize(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitize(entry));
    }

    if (value && typeof value === "object") {
      const next = {};
      for (const [key, entry] of Object.entries(value)) {
        if (this.redactKeys.has(String(key).toLowerCase())) {
          next[key] = "[REDACTED]";
          continue;
        }
        next[key] = this.sanitize(entry);
      }
      return next;
    }

    return value;
  }

  compactEvents(events = []) {
    return events.slice(-this.maxRecentEvents).map((event) => this.sanitize(event));
  }

  summarizeTask(task = {}) {
    const base = {
      id: task.id,
      title: task.title,
      description: task.description,
      goal: task.goal,
      constraints: task.constraints || [],
      successCriteria: task.successCriteria || []
    };
    const serialized = JSON.stringify(this.sanitize(base));
    return serialized.length > this.maxSummaryChars
      ? `${serialized.slice(0, this.maxSummaryChars)}...`
      : serialized;
  }

  buildAdvisorContext(task = {}, state = {}) {
    return {
      taskSummary: this.summarizeTask(task),
      progress: this.sanitize(state.progress || {}),
      recentEvents: this.compactEvents(state.events || []),
      warnings: this.sanitize(state.warnings || []),
      budget: this.sanitize(state.budget || {})
    };
  }
}

module.exports = {
  ContextManager
};