export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function getApiSettings() {
  try { return JSON.parse(localStorage.getItem('am_settings') || '{}'); } catch { return {}; }
}

export function getPrimaryModel() {
  const s = getApiSettings();
  const provider = s.provider || 'anthropic';
  if (provider === 'anthropic') return s.primaryModel || 'claude-sonnet-4-20250514';
  if (provider === 'openrouter') return s.primaryModel || 'anthropic/claude-sonnet-4';
  return s.primaryModel || 'meta-llama/llama-3.3-70b-instruct:free';
}

export function getSecondaryModel() {
  const s = getApiSettings();
  const provider = s.provider || 'anthropic';
  if (provider === 'anthropic') return s.secondaryModel || 'claude-haiku-4-20250514';
  if (provider === 'openrouter') return s.secondaryModel || 'google/gemma-3-27b-it:free';
  return s.secondaryModel || 'google/gemma-3-27b-it:free';
}
