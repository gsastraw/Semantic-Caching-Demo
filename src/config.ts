import "dotenv/config";

export const config = {
    port: Number(process.env.PORT ?? 3000),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? 'all-minilm',
    llmModel: process.env.OLLAMA_LLM_MODEL ?? 'qwen2.5:0.5b-instruct',
    threshold: process.env.CONFIDENCE_THRESHOLD ?? 0.85,
    dbPath: process.env.DATABASE_PATH ?? './data/cache.db'
}
