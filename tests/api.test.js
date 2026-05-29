import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import https from 'https';
import { EventEmitter } from 'events';
import app from '../server/app.js';

describe('POST /api/claude', () => {
  let savedKey;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (savedKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = savedKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    vi.restoreAllMocks();
  });

  it('returns 400 when messages field is missing', async () => {
    const response = await request(app)
      .post('/api/claude')
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid JSON or missing messages');
  });

  it('returns 500 when no API key is available', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await request(app)
      .post('/api/claude')
      .send({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('No API key');
  });

  it('proxies successfully when x-user-api-key header is present', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const mockApiRes = new EventEmitter();
    mockApiRes.statusCode = 200;
    mockApiRes.pipe = (dest) => {
      dest.setHeader('Content-Type', 'application/json');
      dest.end(JSON.stringify({ content: [{ type: 'text', text: 'hello' }] }));
    };

    const mockProxyReq = new EventEmitter();
    mockProxyReq.write = vi.fn();
    mockProxyReq.end = vi.fn();

    vi.spyOn(https, 'request').mockImplementation((opts, cb) => {
      cb(mockApiRes);
      return mockProxyReq;
    });

    const response = await request(app)
      .post('/api/claude')
      .set('x-user-api-key', 'sk-ant-test')
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    expect(response.status).toBe(200);
  });

  it('returns 502 when the upstream connection fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const mockProxyReq = new EventEmitter();
    mockProxyReq.write = vi.fn();
    mockProxyReq.end = vi.fn(function () {
      setImmediate(() => this.emit('error', new Error('ECONNREFUSED')));
    });

    vi.spyOn(https, 'request').mockImplementation(() => mockProxyReq);

    const response = await request(app)
      .post('/api/claude')
      .send({ messages: [{ role: 'user', content: 'test' }] });

    expect(response.status).toBe(502);
    expect(response.body.error).toContain('Proxy error');
  });

  it('forwards custom model and max_tokens to the upstream', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    let sentBody = '';
    const mockApiRes = new EventEmitter();
    mockApiRes.statusCode = 200;
    mockApiRes.pipe = (dest) => dest.end('{}');

    const mockProxyReq = {
      write: vi.fn((data) => { sentBody += data; }),
      end: vi.fn(),
      on: vi.fn(),
    };

    vi.spyOn(https, 'request').mockImplementation((opts, cb) => {
      cb(mockApiRes);
      return mockProxyReq;
    });

    await request(app)
      .post('/api/claude')
      .send({
        messages: [{ role: 'user', content: 'test' }],
        model: 'claude-opus-4-20250514',
        max_tokens: 300,
      });

    const parsed = JSON.parse(sentBody);
    expect(parsed.model).toBe('claude-opus-4-20250514');
    expect(parsed.max_tokens).toBe(300);
    expect(parsed.messages).toHaveLength(1);
  });
});
