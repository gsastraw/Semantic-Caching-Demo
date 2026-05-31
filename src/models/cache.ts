import { UUID } from "node:crypto";

/**
 * CacheEntry exists as a DTO so we do not pass raw DB objects around when interacting
 * with the cache. 
 */
export type CacheEntry = {
  id?: UUID,
  prompt: string,
  context: string;
  normalizedContext: string;
  contextHash: string
  embeddings: number[];
  response: string;
  chatModel: string,
  embeddingModel: string,
  createdAt: Date
}

export type ChatTurn = {
    role: 'user' | 'assistant' | 'system',
    content: string;
}

export type PromptContext = {
    currentPrompt: string;
    history: ChatTurn[];
}

export type PromptResult = {
  answer: string;
  cache:
    | {
        hit: true;
        type: 'exact';
        matchedPrompt: string;
        matchedAt: string;
      }
    | {
        hit: true;
        type: 'semantic';
        distance: number;
        threshold: number;
        matchedPrompt: string;
        matchedAt: string;
      }
    | {
        hit: false;
        type: 'miss';
        reason: string;
        bestDistance?: number;
        threshold: number;
      };
  models: {
    chatModel: string;
    embeddingModel: string;
  };
  context: {
    usedHistoryMessages: number;
    normalizedContext: string;
  };
}
