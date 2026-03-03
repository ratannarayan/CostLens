// ============================================================
// Anthropic AI — API Wrapper for CostLens
// Handles all AI calls: modules, reports, tools, emails
// ============================================================

const { logger } = require('./logger');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/**
 * Call Anthropic Claude API
 * @param {string} systemPrompt - System instructions
 * @param {Array} messages - Chat messages [{role, content}]
 * @param {Object} options - {maxTokens, temperature, model}
 * @returns {Object} Parsed JSON response from Claude
 */
async function callClaude(systemPrompt, messages, options = {}) {
  const {
    maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 8192,
    temperature = 0,
    model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  } = options;

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages
  };
  
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  logger.info(`AI Request: model=${model}, maxTokens=${maxTokens}, msgCount=${messages.length}`);

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error(`Anthropic API error: ${response.status} — ${err}`);
    throw new Error(`AI service error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.map(c => c.text || '').join('') || '';
  
  logger.info(`AI Response: ${text.length} chars, usage: ${JSON.stringify(data.usage)}`);
  
  return { text, usage: data.usage };
}

/**
 * Call Claude and parse JSON response
 * Extracts JSON from response text (handles markdown code blocks)
 */
async function callClaudeJSON(systemPrompt, messages, options = {}) {
  const { text, usage } = await callClaude(systemPrompt, messages, options);
  
  // Extract JSON from response
  let json;
  try {
    // Try direct parse first
    json = JSON.parse(text);
  } catch {
    // Try extracting JSON from markdown or mixed content
    const i1 = text.indexOf('{');
    const i2 = text.lastIndexOf('}');
    if (i1 >= 0 && i2 > i1) {
      json = JSON.parse(text.slice(i1, i2 + 1));
    } else {
      throw new Error('AI response did not contain valid JSON');
    }
  }
  
  return { result: json, usage };
}

/**
 * Build a multimodal message with text + files
 * @param {string} textPrompt - Main text prompt
 * @param {Array} files - [{base64, mimeType, name}]
 * @returns {Object} Message content array
 */
function buildMultimodalContent(textPrompt, files = []) {
  const content = [];
  
  for (const file of files) {
    if (file.mimeType?.startsWith('image/')) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mimeType, data: file.base64 }
      });
    } else if (file.mimeType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.base64 }
      });
    } else {
      // Text-based files (CSV, Excel already parsed to text)
      content.push({
        type: 'text',
        text: `[FILE: ${file.name}]\n${file.textContent}`
      });
    }
  }
  
  content.push({ type: 'text', text: textPrompt });
  return content;
}

module.exports = { callClaude, callClaudeJSON, buildMultimodalContent };
