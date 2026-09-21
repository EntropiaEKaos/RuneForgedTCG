import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./provider";

const DEFAULT_MODEL = "openai/gpt-oss-20b";

export class GroqProvider implements AiProvider {
  readonly id = "groq";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: { apiKey?: string; baseUrl?: string; model?: string } = {}) {
    this.apiKey = options.apiKey ?? process.env.GROQ_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
    this.defaultModel = options.model ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL;
  }

  private async request(request: AiGenerateRequest, responseFormat?: object) {
    if (!this.apiKey) throw new Error("GROQ_API_KEY is not configured");
    const model = request.model ?? this.defaultModel;
    const started = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_completion_tokens: request.maxTokens ?? 700,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      }),
      signal: request.signal,
    });
    if (!response.ok) throw new Error(`Groq request failed (${response.status})`);
    return { body: await response.json(), model, latencyMs: Date.now() - started };
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const { body, model, latencyMs } = await this.request(request);
    return {
      provider: this.id,
      model,
      text: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens,
      outputTokens: body.usage?.completion_tokens,
      latencyMs,
    };
  }

  async generateStructured<T>(request: AiGenerateRequest, schema: object): Promise<T> {
    const { body } = await this.request(request, {
      type: "json_schema",
      json_schema: { name: "runeforged_response", strict: true, schema },
    });
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned no structured content");
    return JSON.parse(content) as T;
  }

  async healthCheck() {
    const started = Date.now();
    try {
      await this.generate({ messages: [{ role: "user", content: "Reply only OK." }], maxTokens: 8, temperature: 0 });
      return { ok: true, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }
}
