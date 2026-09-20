import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./provider";
import { GroqProvider } from "./groq-provider";

export class AiGateway {
  constructor(
    private readonly primary: AiProvider,
    private readonly fallback?: AiProvider,
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    try {
      return await this.primary.generate(request);
    } catch (error) {
      if (!this.fallback) throw error;
      return this.fallback.generate(request);
    }
  }

  async generateStructured<T>(request: AiGenerateRequest, schema: object): Promise<T> {
    try {
      return await this.primary.generateStructured<T>(request, schema);
    } catch (error) {
      if (!this.fallback) throw error;
      return this.fallback.generateStructured<T>(request, schema);
    }
  }
}

export function createGameAiGateway(): AiGateway {
  const provider = process.env.AI_PROVIDER ?? "groq";
  if (provider !== "groq") throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  return new AiGateway(new GroqProvider());
}
