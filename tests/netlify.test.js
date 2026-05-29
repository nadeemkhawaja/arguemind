import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../netlify/functions/claude.js';

function makeReq(method, body, headers = {}) {
  return {
    method,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
    headers: { get: (name) => headers[name.toLowerCase()] || null },
  };
}

const anthropicBody = JSON.stringify({
  content: [{ type: 'text', text: 'Anthropic reply' }],
  usage: { input_tokens: 10, output_tokens: 20 },
});

const openrouterBody = JSON.stringify({
  choices: [{ message: { content: 'OpenRouter reply' } }],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
});

describe('Netlify Edge Function', () => {
  let savedKey;
  let mockFetch;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = savedKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    vi.unstubAllGlobals();
  });

  it('returns 405 for non-POST requests', async () => {
    const res = await handler(makeReq('GET', null));
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('Method not allowed');
  });

  it('returns 400 for an invalid JSON body', async () => {
    const res = await handler(makeReq('POST', new Error('invalid json')));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when the messages field is missing', async () => {
    const res = await handler(makeReq('POST', { model: 'claude-sonnet-4-20250514' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing messages');
  });

  it('returns 500 when no API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const res = await handler(makeReq('POST', {
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('No API key');
  });

  it('routes claude- models to the Anthropic API', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-server-key';
    mockFetch.mockResolvedValue({ status: 200, text: () => Promise.resolve(anthropicBody) });

    const res = await handler(makeReq('POST', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'test' }],
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('routes slash-prefixed models to the OpenRouter API', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: () => Promise.resolve(openrouterBody) });

    const res = await handler(makeReq('POST', {
      model: 'google/gemma-3-27b-it:free',
      messages: [{ role: 'user', content: 'test' }],
    }, { 'x-user-api-key': 'sk-or-test' }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses x-user-api-key header over the server env key', async () => {
    process.env.ANTHROPIC_API_KEY = 'server-key';

    let capturedHeaders;
    mockFetch.mockImplementation((url, opts) => {
      capturedHeaders = opts.headers;
      return Promise.resolve({ status: 200, text: () => Promise.resolve(anthropicBody) });
    });

    await handler(makeReq('POST', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hi' }],
    }, { 'x-user-api-key': 'user-supplied-key' }));

    expect(capturedHeaders['x-api-key']).toBe('user-supplied-key');
  });

  it('defaults max_tokens to 1200 when not specified', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    let capturedBody;
    mockFetch.mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({ status: 200, text: () => Promise.resolve(anthropicBody) });
    });

    await handler(makeReq('POST', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(capturedBody.max_tokens).toBe(1200);
  });
});
