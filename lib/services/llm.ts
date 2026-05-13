// LLM client — Amazon Bedrock Converse API via Bearer auth (long-term API key).
// Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html
//
// We use plain fetch + Bearer auth so this runs in Vercel Edge runtime.
// The Converse API is provider-agnostic; switching from Claude to Nova/Llama
// is a single env-var change to AWS_BEDROCK_MODEL_ID.

export type Role = 'user' | 'assistant';

export interface TextBlock {
  text: string;
}

export interface ImageBlock {
  image: {
    format: 'png' | 'jpeg' | 'gif' | 'webp';
    source: { bytes: string } | { url: string };
  };
}

export type ContentBlock = TextBlock | ImageBlock;

export interface ConverseMessage {
  role: Role;
  content: ContentBlock[];
}

export interface ConverseOptions {
  system?: string;
  messages: ConverseMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ConverseResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

interface BedrockConverseResponse {
  output?: {
    message?: {
      role: string;
      content: Array<{ text?: string }>;
    };
  };
  stopReason?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  message?: string;
}

function endpoint(): string {
  const region = process.env.AWS_BEDROCK_REGION;
  const modelId = process.env.AWS_BEDROCK_MODEL_ID;
  if (!region) throw new Error('AWS_BEDROCK_REGION is not set');
  if (!modelId) throw new Error('AWS_BEDROCK_MODEL_ID is not set');
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;
}

export async function converse(opts: ConverseOptions): Promise<ConverseResult> {
  const apiKey = process.env.AWS_BEDROCK_API_KEY;
  if (!apiKey) throw new Error('AWS_BEDROCK_API_KEY is not set');

  const body = {
    messages: opts.messages,
    ...(opts.system ? { system: [{ text: opts.system }] } : {}),
    inferenceConfig: {
      maxTokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.4,
      topP: opts.topP ?? 0.9,
    },
  };

  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Bedrock ${res.status}: ${text.slice(0, 400)}`);
  }

  const json = JSON.parse(text) as BedrockConverseResponse;
  const blocks = json.output?.message?.content ?? [];
  const responseText = blocks.map((b) => b.text ?? '').join('').trim();

  return {
    text: responseText,
    inputTokens: json.usage?.inputTokens ?? 0,
    outputTokens: json.usage?.outputTokens ?? 0,
    stopReason: json.stopReason ?? 'unknown',
  };
}
