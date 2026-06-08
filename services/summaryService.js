'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

let _client = null;
function getClient() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const e = new Error(
      'AI summary requires an Anthropic API key. Set ANTHROPIC_API_KEY in .env and restart.'
    );
    e.code = 'NO_API_KEY';
    throw e;
  }
  _client = new Anthropic({ apiKey: key });
  return _client;
}

// Per-style instructions live in one place so it's easy to tune them without
// touching the calling code.
const STYLE_PROMPTS = {
  general: `Write a clear, neutral summary of the transcript below. Use:
- A 2-3 sentence overview at the top.
- A bullet list of the main points.
- A short "Notable details" section for anything specific worth remembering.`,

  meeting: `Summarise the transcript below as if it were a meeting recording. Use these sections (use markdown headings):
## Attendees & topic
A one-line summary of who was speaking and what the meeting was about (infer roles if not stated).
## Key discussion points
Bullet list of decisions made and topics debated.
## Action items
A checklist of follow-ups — who owns what, by when, where stated.
## Open questions
Anything left unresolved.`,

  interview: `Summarise the transcript below as if it were an interview. Use markdown headings:
## Subject
Who was interviewed (if inferable) and the broad topic.
## Key takeaways
3-6 bullet points capturing the most quotable, novel, or important things the interviewee said.
## Memorable quotes
2-3 verbatim quotes from the transcript that best capture the interviewee's voice.`,

  podcast: `Summarise the transcript below as if it were a podcast episode. Use markdown headings:
## Episode TL;DR
2-3 sentences describing what the episode covered.
## Topics covered
Bulleted chapter-style list with approximate themes in order.
## Standout moments
Specific quotes, anecdotes, or arguments worth coming back to.`,

  news: `Summarise the transcript below as a news brief. Use markdown headings:
## Headline
One short, factual headline.
## Lede
A 1-2 sentence lede summarising the who/what/when/where/why.
## Key facts
Bulleted list of the concrete facts reported, with numbers, names, places, and dates where given.
## Context
1-3 sentences of background a reader would need to understand the story.`,
};

async function summarise(transcript, style) {
  const styleKey = (style || 'general').toLowerCase();
  const instructions = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS.general;

  const client = getClient();
  const trimmed = (transcript || '').trim();
  if (!trimmed) {
    throw new Error('Cannot summarise an empty transcript.');
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      'You are a careful assistant that writes accurate, well-structured summaries of audio transcripts. ' +
      'Never invent facts. If something is unclear or missing from the transcript, say so. ' +
      'Always reply in markdown.',
    messages: [
      {
        role: 'user',
        content: `${instructions}\n\n---\nTranscript:\n${trimmed}`,
      },
    ],
  });

  // The Messages API returns content as an array of content blocks. We
  // concatenate all text blocks (there's normally just one).
  const out = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!out) throw new Error('Anthropic returned an empty response.');
  return out;
}

module.exports = {
  summarise,
  STYLE_PROMPTS,
};
