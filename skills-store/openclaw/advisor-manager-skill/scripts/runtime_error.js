class AdvisorRuntimeError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AdvisorRuntimeError";
    this.attempts = options.attempts || [];
    this.reason = options.reason || "unresolved-runtime-failure";
    this.causeError = options.causeError || null;
    this.stackTrace = options.stackTrace || (this.causeError ? this.causeError.stack : this.stack);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      reason: this.reason,
      attempts: this.attempts,
      stackTrace: this.stackTrace
    };
  }
}

module.exports = {
  AdvisorRuntimeError
};