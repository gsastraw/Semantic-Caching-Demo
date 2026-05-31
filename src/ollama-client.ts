import { Ollama } from 'ollama';
import { config } from './config.js';

export class OllamaClient {
    readonly ollamaClient = new Ollama({ host: config.ollamaBaseUrl });

    constructor() { }

    public async chat(prompt: string) {
        return await this.ollamaClient.chat({
            model: config.llmModel,
            messages: [{ role: 'user', content: prompt }]
        });
    }

    public async embed(input: string) {
        const response = await this.ollamaClient.embed({ model: config.embeddingModel, input: input });
        const [embedding] = response.embeddings;

        if (!embedding) {
            throw new Error('Ollama did not return an embedding');
        }

        return embedding;
    }

    public async embedMany(inputs: string[]): Promise<number[][]> {
        const response = await this.ollamaClient.embed({
            model: config.embeddingModel,
            input: inputs,
        });

        return response.embeddings;
    }
}
