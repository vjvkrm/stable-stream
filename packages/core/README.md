# @vjvkrm/stable-stream-core

Core engine for parsing, hydrating, and merging streaming JSON from LLMs. Schema-first approach ensures type-safe, layout-stable data from the first byte.

## Installation

```bash
npm install @vjvkrm/stable-stream-core zod
# or
pnpm add @vjvkrm/stable-stream-core zod
```

## Quick Start

```typescript
import { createStableStream } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.number(),
});

// From any LLM SDK that provides text chunks
const textStream = getTextStreamFromLLM(); // AsyncIterable<string>

for await (const { data, state, changedPaths } of createStableStream({
  schema: UserSchema,
  source: textStream,
})) {
  console.log(data);  // Always complete shape: { name: "", email: "", age: 0 }
  console.log(state); // "streaming" | "complete" | "error"
}
```

## Input Contract

`createStableStream` expects the stream to contain a **top-level JSON object**.

- Supported: `{"user":{"name":"Alice"},"items":[...]}`
- Not supported: `["a","b"]` (root-level arrays)

## Why This Exists

When streaming structured JSON from LLMs, you face these problems:

1. **Incomplete JSON** - `{"name": "Jo` is not parseable
2. **Layout shift** - UI jumps as fields appear
3. **Type unsafety** - Partial data breaks TypeScript
4. **Hallucination risk** - LLM may return unexpected fields

This library solves all of them with a schema-first approach.

## Works With Any UI Framework

stable-stream is **UI-agnostic**. It only produces data - plain JavaScript objects. Your UI framework renders it however you want.

```typescript
// The data you get:
const { data } = await createStableStream({ schema, source });
// data = { name: "John", email: "john@example.com", items: [...] }

// Render with ANY framework:
```

**React + Material UI:**
```tsx
<TextField value={data.name} label="Name" />
<DataGrid rows={data.items} columns={columns} />
```

**React + Chakra UI:**
```tsx
<Input value={data.name} />
<Table><Tbody>{data.items.map(row => <Tr>...</Tr>)}</Tbody></Table>
```

**Vue + Vuetify:**
```vue
<v-text-field v-model="data.name" />
<v-data-table :items="data.items" />
```

**Svelte:**
```svelte
<input bind:value={data.name} />
{#each data.items as item}<tr>...</tr>{/each}
```

**Vanilla JS:**
```javascript
document.getElementById('name').value = data.name;
data.items.forEach(item => appendRow(item));
```

**Why it works everywhere:**
- Output is plain objects/arrays - no framework bindings
- No DOM manipulation - just data transformation
- No React hooks or Vue composables in core - those are in `@vjvkrm/stable-stream-react`
- Structural sharing ensures efficient updates in any reactive system

## Architecture

```
JSON chunks → Parser → Hydrated Skeleton → Merge → Stable Data
     ↑                        ↑                         ↓
  LLM stream              Zod Schema            Type-safe output
```

1. **Hydrate**: Generate complete skeleton from schema at T=0
2. **Parse**: Extract complete values from incomplete JSON stream
3. **Merge**: Safely merge parsed values into skeleton (structural sharing)

## API Reference

### `createStableStream(options)`

Main entry point. Creates an async generator that yields stable data on each chunk.

```typescript
interface StableStreamOptions<T extends z.ZodTypeAny> {
  schema: T;                          // Zod schema
  source: AsyncIterable<string>;      // JSON string chunks
  hydrateOptions?: HydrateOptions;    // Optional hydration config
  trim?: boolean;                     // Optional: Remove unfilled skeleton array items on completion (default: false)
  onUpdate?: (update: StreamUpdate<z.infer<T>>) => void;  // Callback
}

interface StreamUpdate<T> {
  data: T;                  // Current merged data (always complete shape)
  state: StreamState;       // "streaming" | "complete" | "error"
  isPartial: boolean;       // True if stream ended incomplete or errored
  completionReason: StreamCompletionReason; // "streaming" | "complete" | "incomplete_json" | "source_error"
  changedPaths: string[];   // Paths that changed: ["name", "items[0].price"]
  error?: Error;            // Error if state is "error"
}
```

**Example:**

```typescript
import { createStableStream } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
  tags: z.array(z.string()),
});

async function streamProduct(textStream: AsyncIterable<string>) {
  for await (const { data, state, isPartial, completionReason, changedPaths } of createStableStream({
    schema: ProductSchema,
    source: textStream,
  })) {
    if (state === "streaming") {
      // Partial but complete shape
      console.log("Loading:", data.name || "...");
    }

    if (state === "complete") {
      console.log("Done:", data, { isPartial, completionReason });
    }

    if (state === "error") {
      console.error("Failed, partial data:", data);
    }
  }
}
```

---

### `consumeStableStream(options)`

Helper that consumes the stream and returns final data. Use when you just want the result.

```typescript
import { consumeStableStream } from '@vjvkrm/stable-stream-core';

const data = await consumeStableStream({
  schema: UserSchema,
  source: textStream,
});
// data is fully typed as z.infer<typeof UserSchema>
```

Note: `consumeStableStream` remains lenient. If JSON is truncated but no source error is thrown, it returns best-effort hydrated data. Use `createStableStream` when you need `isPartial` / `completionReason` diagnostics.

---

### `hydrate(schema, options?)`

Generate a complete skeleton from a Zod schema. Called internally by `createStableStream`.

```typescript
import { hydrate } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
  tags: z.array(z.string()),
  metadata: z.object({
    createdAt: z.string(),
  }),
});

const skeleton = hydrate(schema);
// Result:
// {
//   name: "",
//   age: 0,
//   active: false,
//   tags: [],
//   metadata: { createdAt: "" }
// }
```

**Options:**

```typescript
interface HydrateOptions {
  maxDepth?: number;  // Limit recursion depth (default: 3)
}
```

**Default Values by Type:**

| Zod Type | Default Value |
|----------|---------------|
| `z.string()` | `""` |
| `z.number()` | `0` |
| `z.boolean()` | `false` |
| `z.date()` | `new Date()` |
| `z.null()` | `null` |
| `z.undefined()` | `undefined` |
| `z.array()` | `[]` |
| `z.array().min(n)` | `[skeleton, skeleton, ...]` (n items) |
| `z.object()` | `{ ...hydrated fields }` |
| `z.optional()` | Hydrates inner type |
| `z.nullable()` | Hydrates inner type |
| `z.default(val)` | `val` |
| `z.enum([...])` | First enum value |
| `z.union([...])` | `null` (loading marker) |

**Array Pre-filling with `.min()`:**

Use `.min(n)` to pre-fill arrays with skeleton items. This prevents layout shift when rendering tables/lists.

```typescript
const TableSchema = z.object({
  rows: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })).min(10),  // Pre-fill with 10 skeleton rows
});

const skeleton = hydrate(TableSchema);
// skeleton.rows.length === 10
// skeleton.rows[0] === { id: 0, name: "" }
```

---

### `createIncrementalParser()`

Low-level incremental JSON parser. Extracts complete values from incomplete JSON.

```typescript
import { createIncrementalParser } from '@vjvkrm/stable-stream-core';

const parser = createIncrementalParser();

// Feed chunks as they arrive
let results = parser.process('{"name": "Jo');
// results: [] (incomplete)

results = parser.process('hn", "age": 25}');
// results: [
//   { key: "name", value: "John", path: "name" },
//   { key: "age", value: 25, path: "age" }
// ]
```

**Array Streaming:**

Arrays are streamed item-by-item, not as a single value:

```typescript
const parser = createIncrementalParser();
const results = parser.process('{"tags": ["a", "b", "c"]}');
// results: [
//   { key: "tags", value: "a", path: "tags[0]" },
//   { key: "tags", value: "b", path: "tags[1]" },
//   { key: "tags", value: "c", path: "tags[2]" }
// ]
```

---

### `strictMerge(target, source, options?)`

Merge source into target with hallucination protection. Only allows keys that exist in target.

```typescript
import { strictMerge } from '@vjvkrm/stable-stream-core';

const skeleton = { name: "", age: 0 };
const parsed = { name: "John", age: 25, evil: "HACKED" };

const result = strictMerge(skeleton, parsed, { trackDiscarded: true });
// result.data: { name: "John", age: 25 }
// result.changed: true
// result.changedPaths: ["name", "age"]
// result.discardedKeys: ["evil"]
```

**Structural Sharing:**

Only clones changed paths. Unchanged branches keep the same reference (React-compatible).

```typescript
const target = {
  user: { name: "", profile: { bio: "" } },
  settings: { theme: "dark" },
};
const source = { user: { name: "John" } };

const result = strictMerge(target, source);

result.data.settings === target.settings;  // true (same reference)
result.data.user !== target.user;          // true (new reference)
```

**Type Coercion:**

Safely coerces LLM quirks:

```typescript
// String numbers → actual numbers
strictMerge({ count: 0 }, { count: "42" });
// result.data.count === 42 (number, not string)

// String booleans → actual booleans
strictMerge({ active: false }, { active: "true" });
// result.data.active === true (boolean)
```

---

### `applyParsedValue(target, path, value)`

Apply a single parsed value at a path. Uses structural sharing.

```typescript
import { applyParsedValue } from '@vjvkrm/stable-stream-core';

const state = {
  user: { name: "", email: "" },
  items: [{ id: 0 }, { id: 0 }],
};

// Apply at nested path
let result = applyParsedValue(state, "user.name", "John");
// result.data.user.name === "John"

// Apply at array index
result = applyParsedValue(result.data, "items[0].id", 42);
// result.data.items[0].id === 42
```

---

### `trimSkeleton(data, arrayLengths)`

Remove unfilled skeleton items from arrays. Called internally on stream completion if the `trim` option is enabled.

```typescript
import { trimSkeleton } from '@vjvkrm/stable-stream-core';

const data = {
  rows: [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 0, name: "" },  // Skeleton
    { id: 0, name: "" },  // Skeleton
  ],
};

const lengths = new Map([["rows", 2]]);
const trimmed = trimSkeleton(data, lengths);
// trimmed.rows.length === 2
```

---

## Integration Examples

### Vercel AI SDK

```typescript
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createStableStream } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number(),
  features: z.array(z.string()),
});

async function generateProduct(prompt: string) {
  const { partialObjectStream } = await streamObject({
    model: openai('gpt-4'),
    schema: ProductSchema,
    prompt,
  });

  // Option 1: Use Vercel's partialObjectStream directly (simpler)
  for await (const partial of partialObjectStream) {
    console.log(partial);  // May have undefined fields
  }

  // Option 2: Use stable-stream for guaranteed shape + features
  // Convert to text stream first
  const { textStream } = await streamObject({
    model: openai('gpt-4'),
    schema: ProductSchema,
    prompt,
    output: 'no-schema',  // Get raw JSON text
  });

  for await (const { data, state } of createStableStream({
    schema: ProductSchema,
    source: textStream,
  })) {
    console.log(data.name);        // Always defined (empty string if not yet received)
    console.log(data.features);    // Always array (empty if not yet received)
  }
}
```

**When to use stable-stream over Vercel's built-in `partialObjectStream`:**

| Feature | Vercel partialObjectStream | stable-stream |
|---------|---------------------------|---------------|
| Partial data | Fields may be `undefined` | Always complete shape |
| Array pre-fill | No | Yes (`.min(n)`) |
| Layout stability | UI may jump | No layout shift |
| Change tracking | No | Yes (`changedPaths`) |
| Hallucination protection | Via schema | Extra layer of safety |

### OpenAI SDK

```typescript
import OpenAI from 'openai';
import { createStableStream } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const openai = new OpenAI();

const UserSchema = z.object({
  name: z.string(),
  bio: z.string(),
});

async function generateUser() {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Generate a user profile as JSON' }],
    response_format: { type: 'json_object' },
    stream: true,
  });

  // Extract JSON text from OpenAI stream
  async function* extractJson() {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  for await (const { data } of createStableStream({
    schema: UserSchema,
    source: extractJson(),
  })) {
    console.log(data);
  }
}
```

### Anthropic SDK

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createStableStream } from '@vjvkrm/stable-stream-core';
import { z } from 'zod';

const anthropic = new Anthropic();

const AnalysisSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  keyPoints: z.array(z.string()),
});

async function analyze(text: string) {
  const stream = anthropic.messages.stream({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages: [{ role: 'user', content: `Analyze as JSON: ${text}` }],
  });

  async function* extractJson() {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  for await (const { data } of createStableStream({
    schema: AnalysisSchema,
    source: extractJson(),
  })) {
    console.log(data.summary);
  }
}
```

---

## Advanced Usage

### Custom State Management

```typescript
import { hydrate, createIncrementalParser, applyParsedValue, trimSkeleton } from '@vjvkrm/stable-stream-core';

// Manual control over the pipeline
const schema = z.object({ name: z.string(), items: z.array(z.string()) });

let state = hydrate(schema);
const parser = createIncrementalParser();
const arrayLengths = new Map<string, number>();

async function processChunk(chunk: string) {
  const parsed = parser.process(chunk);

  for (const { path, value } of parsed) {
    const result = applyParsedValue(state, path, value);
    if (result.changed) {
      state = result.data;

      // Track array lengths
      const match = path.match(/^(.+?)\[(\d+)\]/);
      if (match) {
        const [, arrayPath, index] = match;
        arrayLengths.set(arrayPath, Math.max(
          arrayLengths.get(arrayPath) ?? 0,
          parseInt(index) + 1
        ));
      }

      // Notify listeners
      onUpdate(state, result.changedPaths);
    }
  }
}

function finalize() {
  state = trimSkeleton(state, arrayLengths);
  return state;
}
```

### Optimized Re-renders

Use `changedPaths` to minimize re-renders:

```typescript
for await (const { data, changedPaths } of createStableStream({ schema, source })) {
  // Only update components whose data changed
  if (changedPaths.some(p => p.startsWith('user.'))) {
    updateUserComponent(data.user);
  }

  if (changedPaths.some(p => p.startsWith('items['))) {
    updateItemsList(data.items);
  }
}
```

---

## Error Handling

Errors don't throw - they're captured in the stream:

```typescript
for await (const { data, state, error } of createStableStream({ schema, source })) {
  if (state === 'error') {
    console.error('Stream failed:', error.message);
    console.log('Partial data:', data);  // Still available
  }
}
```

Or with `consumeStableStream`:

```typescript
try {
  const data = await consumeStableStream({ schema, source });
} catch (error) {
  console.error('Failed:', error);
}
```

---

## Security

### Hallucination Protection

Only schema-defined keys are accepted:

```typescript
const schema = z.object({ name: z.string() });
const llmResponse = { name: "John", password: "secret", admin: true };

const { data } = strictMerge(hydrate(schema), llmResponse);
// data: { name: "John" }
// password and admin are discarded

This safety also applies recursively to nested objects, arrays, and Union types.
```

### Prototype Pollution Prevention

The merge algorithm uses `Object.hasOwn()` and ignores prototype chain:

```typescript
const malicious = JSON.parse('{"__proto__": {"admin": true}}');
const { data } = strictMerge({ name: "" }, malicious);
// data.__proto__ is not modified
// ({}).admin === undefined (safe)
```

---

## Performance

- **O(n) parsing** - Single pass, no backtracking
- **Structural sharing** - Only changed paths are cloned
- **Minimal allocations** - Reuses unchanged object references
- **No validation overhead** - Schema used for shape, not runtime validation

---

## License

MIT
