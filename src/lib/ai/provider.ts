export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiGenerateRequest {
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AiGenerateResult {
  provider: string;
  model: string;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface AiProvider {
  readonly id: string;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
  generateStructured<T>(request: AiGenerateRequest, schema: object): Promise<T>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}
