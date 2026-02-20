# stable-stream

**Stream structured JSON from LLMs with zero layout shift.**

One library. One import. No crashes. No layout shift. No hallucinations.

```typescript
import { useStableStream } from '@stable-stream/react';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
  bio: z.string(),
});

function UserProfile({ stream }) {
  const { data, isStreaming } = useStableStream({
    schema: UserSchema,
    source: stream,
  });

  // data.name is ALWAYS string, never undefined
  // All fields render from T=0 — no layout shift
  return (
    <div>
      <h1>{data.name || 'Loading...'}</h1>
      <p>{data.email || '...'}</p>
      <p>{data.bio || '...'}</p>
    </div>
  );
}
```

## The Problem

When streaming JSON from LLMs, developers face three issues:

| Problem | What Happens | Result |
|---------|--------------|--------|
| **Crashes** | `data.user.name` throws because `user` hasn't arrived | App breaks |
| **Layout Shift** | UI elements pop in one-by-one as fields arrive | Janky UX |
| **Hallucinations** | LLM sends keys not in your schema | State pollution |

## The Solution

**Schema-first hydration** — your UI is complete from the first render:

```
T=0 (Before data)        T=1 (Streaming)         T=2 (Complete)
─────────────────────────────────────────────────────────────────
{                        {                       {
  name: "",    ← ready     name: "Jo",  ← partial   name: "John",
  email: "",   ← ready     email: "",   ← waiting   email: "john@x.com",
  bio: ""      ← ready     bio: ""      ← waiting   bio: "Engineer..."
}                        }                       }
     ↓                        ↓                       ↓
All fields render        Only text changes       Complete
(no layout shift)        (no layout shift)       (nothing moved)
```

## Installation

```bash
# React (recommended)
npm install @stable-stream/react zod

# Core only (framework-agnostic)
npm install @stable-stream/core zod
```

## Input Contract

stable-stream expects a **top-level JSON object** in the streamed text.

- Supported: `{"name":"Alice","items":[...]}`
- Not supported: `["a","b"]` (root-level arrays)

## Quick Start

### React

```tsx
import { useStableStream } from '@stable-stream/react';
import { z } from 'zod';

const ProfileSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  bio: z.string(),
});

function StreamingProfile({ jsonStream }) {
  const { data, isStreaming, isComplete } = useStableStream({
    schema: ProfileSchema,
    source: jsonStream, // AsyncIterable<string> of JSON chunks
  });

  return (
    <div className={isStreaming ? 'opacity-70' : ''}>
      <h1>{data.name || '...'}</h1>
      <p>{data.title} at {data.company || '...'}</p>
      <p>{data.bio || '...'}</p>
      {isComplete && <button>Save Profile</button>}
    </div>
  );
}
```

### With OpenAI

```tsx
import OpenAI from 'openai';
import { useStableStream } from '@stable-stream/react';

const openai = new OpenAI();

// Extract JSON content from OpenAI stream
async function* streamJson(prompt: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

function App() {
  const [stream, setStream] = useState(null);
  const { data, isComplete } = useStableStream({
    schema: ProfileSchema,
    source: stream,
  });

  const generate = () => {
    setStream(streamJson('Generate a user profile as JSON'));
  };

  return (
    <div>
      <button onClick={generate}>Generate</button>
      <div>{data.name || 'Click to generate...'}</div>
    </div>
  );
}
```

### With Vercel AI SDK

```tsx
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { useStableStream } from '@stable-stream/react';

const { textStream } = streamObject({
  model: openai('gpt-4o'),
  schema: ProfileSchema,
  prompt: 'Generate a user profile',
});

// textStream gives raw JSON chunks - works directly!
const { data } = useStableStream({
  schema: ProfileSchema,
  source: textStream,
});
```

### With Anthropic

```tsx
import Anthropic from '@anthropic-ai/sdk';
import { useStableStream } from '@stable-stream/react';

const anthropic = new Anthropic();

async function* streamJson(prompt: string) {
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

const { data } = useStableStream({
  schema: ProfileSchema,
  source: streamJson('Return a user profile as JSON'),
});
```

### Core (Framework-Agnostic)

```typescript
import { createStableStream } from '@stable-stream/core';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })),
});

const stream = createStableStream({
  schema,
  source: jsonChunks, // AsyncIterable<string>
});

for await (const { data, state } of stream) {
  console.log(data.title);      // string (never undefined)
  console.log(data.items[0]);   // { name: '', price: 0 } (skeleton)
  console.log(state);           // 'streaming' | 'complete' | 'error'
}
```

## Features

- **Zero Layout Shift** — All fields exist from T=0 with skeleton values
- **Type Safety** — `data.field` is always the declared type, never undefined
- **Hallucination Protection** — Keys not in schema (including within Union types) are cleanly discarded
- **Array Pre-fill** — Use `.min(n)` to pre-render skeleton rows
- **Configurable Skeleton Trimming** — Target unfilled array items to be removed at completion via `trim: true`
- **Partial Completion Signals** — Detect truncated/errored streams via `isPartial` and `completionReason`
- **60fps Throttling** — React hook uses RAF to limit re-renders
- **Structural Sharing** — Only changed paths create new references

## Packages

| Package | Description |
|---------|-------------|
| [`@stable-stream/core`](./packages/core) | Parser, hydration, merge — works everywhere |
| [`@stable-stream/react`](./packages/react) | React hook with optimizations |

## How It Works

```
Your LLM SDK (OpenAI, Anthropic, Vercel AI, etc.)
         ↓
JSON string chunks: `{"name": "Jo` (incomplete)
         ↓
┌─────────────────────────────────────┐
│       @stable-stream/core           │
│                                     │
│  1. Incremental JSON Parser         │
│     (handles incomplete JSON)       │
│                                     │
│  2. Schema Hydration                │
│     (generates typed skeleton)      │
│                                     │
│  3. Strict Merge                    │
│     (type-safe, hallucination-safe) │
└─────────────────────────────────────┘
         ↓
    Stable, typed data for your UI
```

## API Reference

### React: `useStableStream(options)`

```typescript
const { data, isStreaming, isComplete, isPartial, completionReason, error, reset } = useStableStream({
  schema: ZodSchema,           // Required: Zod schema
  source: AsyncIterable | string | null, // JSON string chunks or static JSON string (null = don't start)
  throttle: true,              // Optional: true (60fps limit), false (no limit), or number for time-based delay (default: true)
  trim: false,                 // Optional: Remove unfilled skeleton array items (default: false)
  onComplete: (data) => {},    // Optional: Called when stream completes
  onError: (error) => {},      // Optional: Called on error
});
```

### Core: `createStableStream(options)`

```typescript
const stream = createStableStream({
  schema: ZodSchema,            // Required: Zod schema
  source: AsyncIterable<string>, // Required: JSON string chunks
  trim: false,                  // Optional: Remove unfilled skeleton array items (default: false)
});

for await (const { data, state, isPartial, completionReason, changedPaths } of stream) {
  // data: T (always complete shape)
  // state: 'streaming' | 'complete' | 'error'
  // isPartial: boolean
  // completionReason: 'streaming' | 'complete' | 'incomplete_json' | 'source_error'
  // changedPaths: string[] (paths that changed this update)
}
```

### Core: `hydrate(schema)`

Generate a skeleton object from a Zod schema:

```typescript
import { hydrate } from '@stable-stream/core';

const skeleton = hydrate(z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
}));
// { name: '', age: 0, active: false }
```

## License

MIT © Vijay Singh
