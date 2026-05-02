// @ts-ignore — @anthropic-ai/sdk is installed at runtime; type stub used for local dev
import Anthropic from '@anthropic-ai/sdk';

export type AITaskType = 'recipe.bom_from_description';

interface TaskConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

const TASK_CONFIG: Record<AITaskType, TaskConfig> = {
  'recipe.bom_from_description': {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    temperature: 0.2,
  },
};

export interface AIGatewayRequest {
  task: AITaskType;
  systemPrompt: string;
  userMessage: string;
}

export interface AIGatewayResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callAIGateway(request: AIGatewayRequest): Promise<AIGatewayResponse> {
  const config = TASK_CONFIG[request.task];
  const client = new Anthropic();

  const message = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: request.userMessage }],
  });

  const content = message.content[0];
  if (content?.type !== 'text') throw new Error('Unexpected AI response type');

  return {
    content: content.text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
