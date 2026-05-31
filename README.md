# Semantic Caching Demo

A small Node + TypeScript demo that shows how semantic caching works with Ollama, SQLite, and `sqlite-vec`. 

The app accepts a chat prompt, embeds the prompt plus recent conversation history, checks SQLite for a close cached match (configurable), and only calls the LLM when the cache misses.

I chose qwen2.5:0.5b-instruct for the LLM model as it is free and lightweight for demo purposes, as well as All-MiniLM for vector embedding. These can of course be hotswapped without any issues (explained later).

## What It Shows

- Exact cache lookup with a hashed context string
- Semantic lookup with `sqlite-vec`
- Context-aware caching using recent chat history
- A tiny browser UI showing the answer, cache hit/miss, and raw response metadata
- A reset button that clears cache records
- A restart button that clears only the browser conversation

## Requirements

- Docker
- Docker Compose

## Setup

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Start the stack:

```bash
docker compose up --build
```

Pull the Ollama models into the Ollama container:

```bash
docker compose exec ollama ollama pull all-minilm
docker compose exec ollama ollama pull qwen2.5:0.5b-instruct
```

If you would like to use other Ollama models for experimentation's sake, pull your embedding and LLM models of choice, and then configure this in the .env file.

Then open:

```text
http://localhost:3000
```

## Environment

Default values live in `.env.example`:

```env
PORT=3000
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_EMBEDDING_MODEL=all-minilm
OLLAMA_LLM_MODEL=qwen2.5:0.5b-instruct
CONFIDENCE_THRESHOLD=0.10
DATABASE_PATH=./data/cache.db
```
CONFIDENCE_THRESHOLD is the maximum vector distance at which two responses can be considered semantically similar. Lower value = more semantically similar. 

This setting configures how semantically similar responses should be when fetching from the cache, from 0-1 (corresponds to cosine distance)

Inside Docker, `DATABASE_PATH=./data/cache.db` resolves to `/app/data/cache.db`, and `/app/data` is backed by the `sqlite` Docker volume.

## How It Works

1. User sends a prompt and previous conversation history.
2. `PromptService` builds a cache context from the last few chat turns plus the new prompt.
3. The context is normalized and hashed.
4. The app checks SQLite for an exact `contextHash` match.
5. If there is no exact hit, the app embeds the context with Ollama.
6. `CacheService` uses `sqlite-vec` to find nearby cached embeddings.
7. If the best distance is below `CONFIDENCE_THRESHOLD`, the cached response is reused.
8. Otherwise, the app calls the LLM and saves the new response in SQLite.

## Local Development

Install dependencies:

```bash
npm install
```

Run TypeScript build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run the dev server locally:

```bash
npm run dev
```

For local non-Docker development, set `OLLAMA_BASE_URL` to your host Ollama URL, usually:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## Notes

- SQLite does not run as a separate container. The app writes to a SQLite file.
- Ollama models are stored in the `semantic-caching-demo_ollama-data` Docker volume.
- Cache rows are stored in the `semantic-caching-demo_sqlite` Docker volume.
