// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { esc, delay, getApiSettings, getPrimaryModel, getSecondaryModel } from '../src/utils.js';

describe('esc()', () => {
  it('returns empty string for falsy values', () => {
    expect(esc('')).toBe('');
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes < and > characters', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(esc('"hello"')).toBe('&quot;hello&quot;');
  });

  it("escapes single quotes", () => {
    expect(esc("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters together', () => {
    expect(esc('<a href="x" class=\'y\'>R&D</a>')).toBe(
      '&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;R&amp;D&lt;/a&gt;'
    );
  });

  it('coerces numbers to string before escaping', () => {
    expect(esc(42)).toBe('42');
  });

  it('leaves plain text unchanged', () => {
    expect(esc('hello world')).toBe('hello world');
  });
});

describe('delay()', () => {
  it('resolves after at least the specified milliseconds', async () => {
    const start = Date.now();
    await delay(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });

  it('resolves with undefined', async () => {
    const result = await delay(0);
    expect(result).toBeUndefined();
  });

  it('returns a Promise', () => {
    const p = delay(0);
    expect(p).toBeInstanceOf(Promise);
  });
});

describe('getApiSettings()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty object when nothing is stored', () => {
    expect(getApiSettings()).toEqual({});
  });

  it('returns the parsed object from localStorage', () => {
    localStorage.setItem('am_settings', JSON.stringify({ provider: 'openrouter', apiKey: 'sk-or-abc' }));
    expect(getApiSettings()).toEqual({ provider: 'openrouter', apiKey: 'sk-or-abc' });
  });

  it('returns an empty object when the stored value is invalid JSON', () => {
    localStorage.setItem('am_settings', 'not-valid-json{{{');
    expect(getApiSettings()).toEqual({});
  });
});

describe('getPrimaryModel()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to claude-sonnet when no settings are stored', () => {
    expect(getPrimaryModel()).toBe('claude-sonnet-4-20250514');
  });

  it('returns a custom anthropic model when configured', () => {
    localStorage.setItem('am_settings', JSON.stringify({
      provider: 'anthropic',
      primaryModel: 'claude-opus-4-20250514',
    }));
    expect(getPrimaryModel()).toBe('claude-opus-4-20250514');
  });

  it('defaults to anthropic/claude-sonnet-4 for openrouter provider', () => {
    localStorage.setItem('am_settings', JSON.stringify({ provider: 'openrouter' }));
    expect(getPrimaryModel()).toBe('anthropic/claude-sonnet-4');
  });

  it('returns a custom openrouter model when configured', () => {
    localStorage.setItem('am_settings', JSON.stringify({
      provider: 'openrouter',
      primaryModel: 'google/gemma-3-27b-it:free',
    }));
    expect(getPrimaryModel()).toBe('google/gemma-3-27b-it:free');
  });

  it('defaults to meta-llama for the free provider', () => {
    localStorage.setItem('am_settings', JSON.stringify({ provider: 'free' }));
    expect(getPrimaryModel()).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });
});

describe('getSecondaryModel()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to claude-haiku when no settings are stored', () => {
    expect(getSecondaryModel()).toBe('claude-haiku-4-20250514');
  });

  it('returns a custom secondary anthropic model when configured', () => {
    localStorage.setItem('am_settings', JSON.stringify({
      provider: 'anthropic',
      secondaryModel: 'claude-opus-4-20250514',
    }));
    expect(getSecondaryModel()).toBe('claude-opus-4-20250514');
  });

  it('defaults to google/gemma for openrouter provider', () => {
    localStorage.setItem('am_settings', JSON.stringify({ provider: 'openrouter' }));
    expect(getSecondaryModel()).toBe('google/gemma-3-27b-it:free');
  });

  it('defaults to google/gemma for the free provider', () => {
    localStorage.setItem('am_settings', JSON.stringify({ provider: 'free' }));
    expect(getSecondaryModel()).toBe('google/gemma-3-27b-it:free');
  });
});
