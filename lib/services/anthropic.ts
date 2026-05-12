import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const AUDIT_MODEL = 'claude-opus-4-7';
export const CHAT_MODEL = 'claude-sonnet-4-6';
