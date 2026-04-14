class ModelConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ModelConfigurationError";
    this.details = details;
  }
}

module.exports = {
  ModelConfigurationError
};