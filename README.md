# Stable Stream

**End-to-end streaming structured output from LLMs to stable UIs.**

One library. One import. No layout shift. No crashes. No hallucinations.

```typescript
import { createStableStream } from '@stable-stream/core';
import { streamText } from 'ai';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  bio: z.string(),
});

// Any SDK that gives you a text stream works
const { textStream } = streamText({
  model: 'openai/gpt-4',
  prompt: 'Generate a user profile as JSON',
});

// Feed text stream to stable-stream
const stream = createStableStream({
  schema,
  source: textStream,
});

for await (const { data, state } of stream) {
  console.log(data.name);  // TypeScript knows this is `string`, never undefined
  console.log(state.completionRatio);  // 0.0 -> 1.0
}
```

## The Problem

When streaming JSON from LLMs to a UI, developers face three critical issues:

| Problem | What Happens | User Experience |
|---------|--------------|-----------------|
| **Crash Risk** | `data.user.name` throws because `user` hasn't arrived yet | App breaks |
| **Layout Shift** | UI elements pop in one-by-one as data arrives | Janky, unprofessional |
| **Hallucinations** | LLM sends random keys not in your schema | State pollution, validation errors |

## The Solution

Stable Stream uses **schema-first hydration**:

```
T=0 (Before data)        T=1 (Partial)           T=2 (Complete)
─────────────────────────────────────────────────────────────────

hydrate(schema)          strictMerge()           strictMerge()
       ↓                       ↓                       ↓
{                        {                       {
  name: "",    ← ready     name: "Jo", ← partial   name: "John",
  age: 0,      ← ready     age: 0,     ← waiting   age: 25,
  bio: ""      ← ready     bio: ""     ← waiting   bio: "Engineer"
}                        }                       }
       ↓                       ↓                       ↓
UI renders ALL           UI updates name         UI complete
fields immediately       (no layout shift)       (nothing moved)
```

**Result:** Zero layout shift. 100% type safety. Hallucinations discarded.

## How It Works

```
LLM SDK text stream (Vercel AI, LangGraph, etc.)
         ↓
Text chunks: `{"name": "Jo` (incomplete JSON)
         ↓
┌─────────────────────────────────────┐
│       @stable-stream/core           │
│                                     │
│  1. Incremental JSON Parser         │
│  2. Schema Hydration (skeleton)     │
│  3. Strict Merge (hallucination-    │
│     safe, type-safe)                │
└─────────────────────────────────────┘
         ↓
    Type-safe data for your UI
```

## Features

- **Schema-First** - Define once with Zod, get typed skeletons automatically
- **Hallucination Protection** - Unknown keys from LLM are discarded
- **Zero Layout Shift** - All UI fields exist from T=0
- **Type Safety** - `data.field` is always the correct type, never undefined
- **SDK Agnostic** - Works with any text stream (Vercel AI SDK, LangGraph, etc.)
- **Framework Agnostic** - Core is isomorphic (Node, Browser, Edge)

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@stable-stream/core` | Parsing, hydration, merge engine | In Progress |
| `@stable-stream/react` | React hook with RAF throttling | Planned |

## Installation

```bash
# Coming soon
pnpm add @stable-stream/core zod
```

## Usage

### Basic (Core)

```typescript
import { createStableStream } from '@stable-stream/core';
import { streamText } from 'ai';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
});

// Use any SDK that provides a text stream
const { textStream } = streamText({
  model: 'openai/gpt-4',
  prompt: 'Generate a user profile as JSON',
});

// Feed text stream to stable-stream
const stream = createStableStream({
  schema: UserSchema,
  source: textStream,
});

for await (const { data, state } of stream) {
  console.log(data);
  // T=0: { name: "", email: "", age: 0 }
  // T=1: { name: "John", email: "", age: 0 }
  // T=2: { name: "John", email: "john@example.com", age: 0 }
  // T=3: { name: "John", email: "john@example.com", age: 30 }

  if (state.isComplete) {
    console.log('Done!');
  }
}
```

### React (Coming Soon)

```typescript
import { useStableStream } from '@stable-stream/react';

function UserProfile({ streamSource }) {
  const { data, state } = useStableStream({
    schema: UserSchema,
    source: streamSource,
  });

  return (
    <div>
      <h1>{data.name || 'Loading...'}</h1>
      <p>{data.email || '...'}</p>
      <p>Age: {data.age || '—'}</p>
      {state.isComplete && <button>Save</button>}
    </div>
  );
}
```

## API

### `createStableStream(options)`

Creates an async iterable that yields typed, stable data as the stream progresses.

```typescript
interface StableStreamOptions<T> {
  schema: ZodSchema<T>;                      // Your Zod schema
  source: string | AsyncIterable<string>;   // JSON string or async iterable of JSON chunks
}

interface StreamYield<T> {
  data: T;                    // Always complete shape, never undefined fields
  state: {
    isComplete: boolean;      // True when stream finished
    completionRatio: number;  // 0.0 -> 1.0
    changedPaths: string[];   // Fields that changed this tick
    discardedKeys: string[];  // Hallucinated keys that were dropped
  };
}
```

### `hydrate(schema, options?)`

Generates a skeleton object from a Zod schema. Used internally by `createStableStream`.

```typescript
import { hydrate } from '@stable-stream/core';

const skeleton = hydrate(UserSchema);
// { name: "", email: "", age: 0 }
```

### `strictMerge(skeleton, partial)`

Merges partial data into skeleton, discarding unknown keys. Used internally.

```typescript
import { strictMerge } from '@stable-stream/core';

const result = strictMerge(
  { name: "", age: 0 },
  { name: "John", age: 25, hackerKey: "ignored" }
);
// { name: "John", age: 25 } - hackerKey discarded
```

## Documentation

- [PRD](./PRD.md) - Product requirements
- [Exploration](./exploration.md) - Feature research, roadmap, and market validation
- [Implementation Plan](./implementation_plan.md) - Technical plan
- [Parser Test Cases](./parser-test-cases.md) - 65 test cases for incremental parser
- [Hydration Challenges](./hydration_challenges.md) - Technical deep-dive

## License

MIT
