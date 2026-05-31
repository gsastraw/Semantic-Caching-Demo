const form = document.querySelector('#chat-form');
const message = document.querySelector('#message');
const submitButton = document.querySelector('#submit-button');
const restartButton = document.querySelector('#restart-button');
const resetButton = document.querySelector('#reset-button');
const conversation = document.querySelector('#conversation');
const answer = document.querySelector('#answer');
const cacheSummary = document.querySelector('#cache-summary');
const cacheInfo = document.querySelector('#cache-info');
const fullResponse = document.querySelector('#full-response');

const chatHistory = [];

restartButton.addEventListener('click', () => {
  chatHistory.length = 0;
  conversation.textContent = '[]';
  answer.textContent = 'Conversation restarted. Cache was not changed.';
  cacheSummary.textContent = 'Conversation only was reset.';
  cacheInfo.textContent = 'Cache records are still stored.';
  fullResponse.textContent = 'No response yet.';
});

resetButton.addEventListener('click', async () => {
  resetButton.disabled = true;
  resetButton.textContent = 'RESETTING...';

  try {
    const response = await fetch('/cache', { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(result, null, 2));
    }

    cacheSummary.textContent = `Cache reset. Deleted records: ${result.deletedRecords}.`;
    cacheInfo.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    cacheSummary.textContent = 'Cache reset failed.';
    cacheInfo.textContent = errorMessage;
  } finally {
    resetButton.disabled = false;
    resetButton.textContent = 'RESET cache';
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();

  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  answer.textContent = 'Loading...';
  cacheSummary.textContent = 'Loading...';
  cacheInfo.textContent = 'Loading...';
  fullResponse.textContent = 'Loading...';

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.value,
        history: chatHistory,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(result, null, 2));
    }

    answer.textContent = result.answer;
    cacheSummary.textContent = summarizeCache(result.cache);
    cacheInfo.textContent = JSON.stringify(result.cache, null, 2);
    fullResponse.textContent = JSON.stringify(result, null, 2);

    chatHistory.push({ role: 'user', content: message.value });
    chatHistory.push({ role: 'assistant', content: result.answer });
    conversation.textContent = JSON.stringify(chatHistory, null, 2);
    message.value = '';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    answer.textContent = errorMessage;
    cacheSummary.textContent = 'Request failed.';
    cacheInfo.textContent = 'Request failed.';
    fullResponse.textContent = errorMessage;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send';
  }
});

function summarizeCache(cache) {
  if (!cache) {
    return 'No cache metadata returned.';
  }

  if (!cache.hit) {
    const bestDistance = cache.bestDistance === undefined ? 'none' : cache.bestDistance;
    return `Cache miss. Best distance: ${bestDistance}. Threshold: ${cache.threshold}.`;
  }

  if (cache.type === 'exact') {
    return `Exact cache hit. Matched prompt: "${cache.matchedPrompt}".`;
  }

  return `Semantic cache hit. Distance: ${cache.distance}. Threshold: ${cache.threshold}. Matched prompt: "${cache.matchedPrompt}".`;
}
