const https = require("https");
const http = require("http");
const url = require("url");

function httpsPostJson(fullUrl, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(fullUrl);
    const transport = parsed.protocol === "https:" ? https : http;
    const payload = JSON.stringify(body);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers
      }
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 500)}`));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error("Request timeout (120s)"));
    });
    req.write(payload);
    req.end();
  });
}

const PROVIDER_MAP = {
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY"
  },
  stepfun: {
    baseUrl: "https://api.stepfun.com/v1",
    apiKeyEnv: "STEPFUN_API_KEY"
  },
  moonshot: {
    baseUrl: "https://api.moonshot.cn/v1",
    apiKeyEnv: "MOONSHOT_API_KEY"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY"
  },
  anthropic: {
    baseUrl: null,
    apiKeyEnv: "ANTHROPIC_API_KEY",
    note: "anthropic-messages API — needs separate handler"
  }
};

function getApiKey(envName) {
  const key = process.env[envName];
  if (!key) throw new Error(`Missing environment variable: ${envName}`);
  return key;
}

const SECTION_PLAN = [
  { num: 1, title: "宏观经济影响", desc: "AI对全球GDP增长的贡献、生产力提升数据、宏观经济模型预测" },
  { num: 2, title: "行业变革", desc: "金融、医疗、制造、零售、教育等行业的AI应用深度和转型案例" },
  { num: 3, title: "劳动力市场", desc: "就业结构变化、技能需求转型、AI替代与创造就业的平衡分析" },
  { num: 4, title: "投资与融资", desc: "全球AI投资趋势、主要投资领域、估值变化、IPO与并购动态" },
  { num: 5, title: "地缘经济格局", desc: "中美欧AI竞赛、技术主权、监管差异、供应链重组" },
  { num: 6, title: "成本与效率", desc: "企业AI部署成本变化、ROI数据、中小企业渗透率" },
  { num: 7, title: "风险与挑战", desc: "AI安全风险、数据隐私、伦理问题、监管合规挑战" },
  { num: 8, title: "未来展望", desc: "2027-2030年趋势预测、关键技术突破预期" }
];

function buildSystemPrompt(payload) {
  const purpose = payload.purpose || "task";
  const isAdvisor = purpose === "initial_planning" || purpose === "mid_task_guidance" || purpose === "quality_assurance";

  if (purpose === "initial_planning") {
    return `你是一位资深的AI经济研究顾问。你的任务是为一份关于"AI在2025-2026年全球经济中的影响"的调查报告制定详细的写作计划和结构大纲。

要求：
1. 规划8个章节的写作顺序和篇幅分配
2. 每章节列出关键数据点和案例
3. 标注数据来源建议
4. 给出整体报告的时间线和里程碑

请用中文输出，使用Markdown格式。`;
  }

  if (purpose === "mid_task_guidance") {
    return `你是一位资深的AI经济研究顾问。请审查当前调查报告的写作进度，并提供改进建议。

关注：
1. 已完成的章节质量评估
2. 缺失的数据和案例
3. 结构优化建议
4. 下一步写作的重点方向

请用中文输出，使用Markdown格式。`;
  }

  if (purpose === "quality_assurance") {
    return `你是一位资深的AI经济研究报告审稿人。请对完整的调查报告进行最终质量审查。

审查维度：
1. 内容完整性（8个章节是否齐全）
2. 数据准确性和时效性
3. 逻辑连贯性和论证深度
4. 格式规范性和可读性
5. 给出最终评分和改进建议

请用中文输出，使用Markdown格式。`;
  }

  // Executor pass
  const step = payload.step || 1;
  const section = SECTION_PLAN[step - 1];

  if (section) {
    return `你是一位专业的AI经济研究报告撰写人。你正在撰写一份关于"AI在2025-2026年全球经济中的影响"的详尽调查报告。

当前任务：撰写第 ${step} 章 ——「${section.title}」
章节要点：${section.desc}

写作要求：
- 使用专业、客观的学术语言
- 引用具体数据和案例（标注来源）
- 提供深入的分析和见解
- 使用Markdown格式，包含适当的标题、列表、表格
- 字数不少于800字
- 语言：中文

${payload.advisorAdvice ? `### 顾问指导建议\n\n${payload.advisorAdvice}\n\n请根据以上建议调整你的写作。` : ""}`;
  }

  // Generic executor
  return `你是一位专业的AI经济研究报告撰写人。请继续完善"AI在2025-2026年全球经济中的影响"调查报告的当前章节。

要求：
- 专业、客观、有深度
- 使用Markdown格式
- 语言：中文
- 提供具体数据和案例

${payload.advisorAdvice ? `### 顾问指导建议\n\n${payload.advisorAdvice}` : ""}`;
}

function buildUserPrompt(payload) {
  const parts = [];

  if (payload.taskTitle) parts.push(`# ${payload.taskTitle}`);
  if (payload.taskDescription) parts.push(`\n${payload.taskDescription}`);

  if (payload.purpose === "executor-pass") {
    const step = payload.step || 1;
    const totalSteps = payload.estimatedSteps || 8;
    parts.push(`\n## 当前进度: 第 ${step}/${totalSteps} 步 (迭代 #${payload.iteration || 1})`);
  }

  if (payload.constraints && payload.constraints.length > 0) {
    parts.push(`\n## 约束条件\n${payload.constraints.map(c => `- ${c}`).join("\n")}`);
  }

  if (payload.successCriteria && payload.successCriteria.length > 0) {
    parts.push(`\n## 成功标准\n${payload.successCriteria.map(c => `- ${c}`).join("\n")}`);
  }

  return parts.join("\n");
}

class ProviderClient {
  constructor(registry = {}) {
    this.registry = registry;
  }

  async invoke(roleConfig = {}, payload = {}) {
    const provider = roleConfig.provider || "stub";
    const handler = this.registry[provider];

    if (typeof handler === "function") {
      return handler(roleConfig, payload);
    }

    // Try real API call if provider is known
    const providerInfo = PROVIDER_MAP[provider];
    if (providerInfo && providerInfo.baseUrl) {
      return this.realApiCall(providerInfo, roleConfig, payload);
    }

    // Fall back to stub
    return ProviderClient.stubResponse(roleConfig, payload);
  }

  async realApiCall(providerInfo, roleConfig, payload) {
    const apiKey = getApiKey(providerInfo.apiKeyEnv);
    const modelId = roleConfig.model || roleConfig.alias || "unknown";
    const provider = roleConfig.provider || "unknown";
    const purpose = payload.purpose || "task";

    process.stderr.write(`   🔄 调用 ${modelId} (${provider}) → ${purpose}...\n`);

    const messages = [
      { role: "system", content: buildSystemPrompt(payload) },
      { role: "user", content: buildUserPrompt(payload) }
    ];

    const response = await httpsPostJson(
      `${providerInfo.baseUrl}/chat/completions`,
      {
        model: modelId,
        messages,
        temperature: 0.7,
        max_tokens: 8192
      },
      {
        "Authorization": `Bearer ${apiKey}`
      }
    );

    const choice = response.choices && response.choices[0];
    const message = choice && choice.message ? choice.message : {};
    let content = message.content || "";
    const reasoning = message.reasoning || "";
    if (!content && reasoning) content = reasoning;
    if (!content) content = "[模型未返回内容]";
    const usage = response.usage || {};

    process.stderr.write(`   ✅ ${modelId} 完成: ${usage.prompt_tokens || 0}→${usage.completion_tokens || 0} tokens\n`);

    return {
      role: roleConfig.alias || roleConfig.model,
      provider: roleConfig.provider,
      purpose,
      content,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      metadata: {
        stubbed: false,
        model: modelId,
        provider,
        finishReason: choice ? choice.finish_reason : null
      }
    };
  }

  static stubResponse(roleConfig = {}, payload = {}) {
    const role = roleConfig.alias || roleConfig.model || "unknown-role";
    const summary = payload.purpose || "no-purpose";

    if (payload.forceFailure) {
      throw new Error(`Stubbed failure for ${role} during ${summary}.`);
    }

    return {
      role,
      provider: roleConfig.provider || "stub",
      purpose: summary,
      content: `Stubbed ${role} response for ${summary}.`,
      usage: {
        inputTokens: 800,
        outputTokens: 220
      },
      metadata: {
        stubbed: true
      }
    };
  }
}

module.exports = {
  ProviderClient,
  PROVIDER_MAP,
  SECTION_PLAN
};
