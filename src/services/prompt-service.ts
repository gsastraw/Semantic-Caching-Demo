import { CacheEntry, ChatTurn, PromptResult } from "../models/cache.js";
import { OllamaClient } from "../ollama-client.js";
import { CacheService } from "./cache-service.js";
import { config } from "../config.js";

import { createHash, randomUUID } from 'node:crypto';

/**
 * PromptService's responsibility is to take user prompts, and decide whether or not the user's request should return a 
 * response from the cache, or a response from the actual LLM. 
 * 
 */

export class PromptService {
    private cacheService: CacheService;
    private ollamaClient: OllamaClient;

    constructor(
    ) {
        this.cacheService = new CacheService();
        this.ollamaClient = new OllamaClient();
    }
    
    public async chat(prompt: string, history: ChatTurn[] = []): Promise<PromptResult> {
        /**
         * Clears all whitespace from start and end
         * Turns any consecutive whitespaces into a singlespace
         */

        if (!prompt.trim()) {
            throw new Error('Prompt is required');
        }

        const cacheContext = this.buildCacheContext(prompt, history);
        const normalizedContext = this.normalizedPrompt(cacheContext);
        const hashedContext = this.hashedPrompt(normalizedContext);
        const threshold = Number(config.threshold);

        /**
         * We want to find an exact match first, as we know that if the hashed context is the exact same as a context in the cache, we know it 
         * is the exact same context, prompt, chat model, and embedding model. 
         */
        const exactMatch = this.cacheService.findExactMatch(
            hashedContext,
            config.llmModel,
            config.embeddingModel,
        );

        if (exactMatch) {
            return {
                answer: exactMatch.response,
                cache: {
                    hit: true,
                    type: 'exact',
                    matchedPrompt: exactMatch.prompt,
                    matchedAt: exactMatch.createdAt.toISOString(),
                },
                models: this.models(),
                context: {
                    usedHistoryMessages: this.usedHistoryMessages(history),
                    normalizedContext,
                },
            };
        }

        const searchOptions = {
            chatModel: config.llmModel,
            embeddingModel: config.embeddingModel,
            limit: 1,
        };

        const embedding = await this.ollamaClient.embed(cacheContext);
        const semanticMatches = this.cacheService.findSemanticMatches(embedding, searchOptions);
        const semanticMatch = semanticMatches.at(0);

        if (semanticMatch && semanticMatch.distance <= threshold) {
            return {
                answer: semanticMatch.entry.response,
                cache: {
                    hit: true,
                    type: 'semantic',
                    distance: semanticMatch.distance,
                    threshold,
                    matchedPrompt: semanticMatch.entry.prompt,
                    matchedAt: semanticMatch.entry.createdAt.toISOString(),
                },
                models: this.models(),
                context: {
                    usedHistoryMessages: this.usedHistoryMessages(history),
                    normalizedContext,
                },
            };
        }

        const response = (await this.ollamaClient.chat(cacheContext)).message.content;

        const cacheEntry: CacheEntry = {
            id: randomUUID(),
            prompt: prompt,
            context: cacheContext,
            normalizedContext: normalizedContext,
            contextHash: hashedContext,
            embeddings: embedding,
            response: response,
            chatModel: config.llmModel,
            embeddingModel: config.embeddingModel,
            createdAt: new Date(),
        }

        this.cacheService.save(cacheEntry);

        return {
            answer: response,
            cache: {
                hit: false,
                type: 'miss',
                reason: 'No exact match or semantic match under threshold',
                bestDistance: semanticMatch?.distance,
                threshold,
            },
            models: this.models(),
            context: {
                usedHistoryMessages: this.usedHistoryMessages(history),
                normalizedContext,
            },
        };
    }

    public clearCache() {
        return this.cacheService.clear();
    }

    private normalizedPrompt(prompt: string) {
        return prompt.trim().replace(/\s+/g, " ");
    }

    private hashedPrompt(prompt: string) {
        return createHash('sha256').update(prompt).digest('hex');
    }

    /**
     * Builds the cache context so that we can normalise, as well as hash.
     * @param currentPrompt 
     * @param history 
     * @returns Example output:
     * 
     * user: My app uses TypeScript
     * assistant: Nice, what are you building?
     * user: How should I cache this?
     */
    private buildCacheContext(currentPrompt: string, history: ChatTurn[]) {
        // Get the last six messages to start
        const relevantHistory = history.slice(-6);

        return [
            ...relevantHistory.map(turn => `${turn.role}: ${turn.content}`),
            `user: ${currentPrompt}`,
        ].join('\n');
    }

    private usedHistoryMessages(history: ChatTurn[]) {
        return history.slice(-6).length;
    }

    private models() {
        return {
            chatModel: config.llmModel,
            embeddingModel: config.embeddingModel,
        };
    }
}
