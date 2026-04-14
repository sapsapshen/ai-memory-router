const fs = require("fs");
const path = require("path");

function toTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

class ExecutionLogger {
  constructor(runtimeConfig = {}) {
    const telemetry = runtimeConfig.telemetry || {};
    this.outputDir = path.resolve(process.cwd(), telemetry.output_dir || "out");
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.filePath = null;
    this.finished = false;
  }

  start(task = {}) {
    const safeTaskId = String(task.id || "task").replace(/[^a-zA-Z0-9-_]/g, "-");
    this.filePath = path.join(this.outputDir, `${toTimestamp()}-${safeTaskId}.md`);
    this.finished = false;
    const header = [
      `# Advisor Claw Execution Log`,
      "",
      `- Task ID: ${task.id || "unknown"}`,
      `- Title: ${task.title || "untitled"}`,
      `- Started At: ${new Date().toISOString()}`,
      "",
      "## Timeline",
      ""
    ].join("\n");
    fs.writeFileSync(this.filePath, header, "utf8");
    return this.filePath;
  }

  append(entry = {}) {
    if (!this.filePath) {
      throw new Error("Execution log has not been started.");
    }

    const lines = [
      `### ${entry.timestamp || new Date().toISOString()} | ${entry.role || "unknown-role"} | ${entry.model || "unknown-model"}`,
      "",
      `- Command: ${entry.command || "n/a"}`,
      `- Outcome: ${entry.outcome || "n/a"}`
    ];

    if (entry.details) {
      lines.push(`- Details: ${entry.details}`);
    }

    if (entry.error) {
      lines.push("- Error:");
      lines.push("```text");
      lines.push(entry.error);
      lines.push("```");
    }

    lines.push("");
    fs.appendFileSync(this.filePath, `${lines.join("\n")}\n`, "utf8");
  }

  finish(summary = {}) {
    if (!this.filePath || this.finished) {
      return this.filePath;
    }

    const lines = [
      "## Final Summary",
      "",
      `- Finished At: ${new Date().toISOString()}`,
      `- Status: ${summary.status || "unknown"}`,
      `- Quality Tier: ${summary.qualityTier || "unknown"}`,
      `- Efficiency Tier: ${summary.efficiencyTier || "unknown"}`,
      `- Quality Score: ${summary.qualityScore != null ? `${summary.qualityScore}/100` : "n/a"}`,
      `- Completed Steps: ${summary.completedSteps != null ? summary.completedSteps : "n/a"}/${summary.totalSteps != null ? summary.totalSteps : "n/a"}`,
      `- Advisor Calls: ${summary.advisorCalls != null ? summary.advisorCalls : "n/a"}`,
      `- Recovery Attempts: ${summary.recoveryAttempts != null ? summary.recoveryAttempts : "n/a"}`,
      `- Warnings: ${summary.warningCount != null ? summary.warningCount : "n/a"}`,
      ""
    ];

    if (summary.failureReason) {
      lines.push(`- Failure Reason: ${summary.failureReason}`);
      lines.push("");
    }

    lines.push("## Execution Quality vs Resource Comparison");
    lines.push("");
    lines.push("| Dimension | Quality Signal | Resource Signal | Assessment |");
    lines.push("| --- | --- | --- | --- |");
    lines.push(`| Completion | ${summary.completedSteps != null ? `${summary.completedSteps}/${summary.totalSteps}` : "n/a"} | ${summary.totalTokens != null ? `${summary.totalTokens} tokens` : "n/a"} | ${summary.completionAssessment || "n/a"} |`);
    lines.push(`| Review Coverage | ${summary.reviewCoverage || "n/a"} | Advisor ${summary.advisorTokens != null ? `${summary.advisorTokens} tokens` : "n/a"}, ${summary.advisorUsd != null ? `$${summary.advisorUsd.toFixed(6)}` : "n/a"} | ${summary.reviewAssessment || "n/a"} |`);
    lines.push(`| Stability | Recoveries ${summary.recoveryAttempts != null ? summary.recoveryAttempts : "n/a"}, warnings ${summary.warningCount != null ? summary.warningCount : "n/a"} | Executor ${summary.executorTokens != null ? `${summary.executorTokens} tokens` : "n/a"}, ${summary.executorUsd != null ? `$${summary.executorUsd.toFixed(6)}` : "n/a"} | ${summary.stabilityAssessment || "n/a"} |`);
    lines.push(`| Overall | ${summary.qualityTier || "n/a"} (${summary.qualityScore != null ? `${summary.qualityScore}/100` : "n/a"}) | ${summary.totalTokens != null ? `${summary.totalTokens} tokens` : "n/a"}, ${summary.totalUsd != null ? `$${summary.totalUsd.toFixed(6)}` : "n/a"} | ${summary.overallAssessment || "n/a"} |`);
    lines.push("");

    fs.appendFileSync(this.filePath, `${lines.join("\n")}\n`, "utf8");
    this.finished = true;
    return this.filePath;
  }
}

module.exports = {
  ExecutionLogger
};