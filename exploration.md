# Exploration: Stable Stream

> Scratchpad for tracking features, improvements, and research insights.

---

## Core Value Proposition

**End-to-end streaming structured output from LLM to stable UI.**

One library. One import. No wiring up multiple packages.

```typescript
import { createStableStream } from '@stable-stream/core';
import { streamText } from 'ai';

const { textStream } = streamText({
  model: 'openai/gpt-4',
  prompt: 'Generate a user as JSON',
});

const stream = createStableStream({
  schema: myZodSchema,
  source: textStream,  // Any AsyncIterable<string>
});

for await (const { data, state } of stream) {
  // data: fully typed, no undefined, no hallucinations
  // state: { completionRatio, changedPaths, isComplete }
}
```

**What makes it unique:**
1. **Incremental JSON parsing** - Handles incomplete JSON string chunks
2. **Schema-first hydration** - Complete typed skeleton at T=0
3. **Strict merge** - Target-first traversal that DISCARDS hallucinated keys
4. **Type safety guarantee** - `data.user.age` is `number`, not `number | undefined`

---

## Architectural Decision: Simplified Input Boundary

### Input Boundary

Library accepts any `AsyncIterable<string>` of text chunks. Most modern SDKs already provide this.

**Why this works:**
- Vercel AI SDK: `textStream` from `streamText()`
- LangGraph: `streamMode: "custom"` chunks
- OpenAI SDK: Can be wrapped easily
- Any SDK with text streaming works out of the box

| SDK | Text Stream |
|-----|-------------|
| Vercel AI SDK | `textStream` from `streamText()` |
| LangGraph | `graph.stream()` with `streamMode: "custom"` |
| OpenAI SDK | `chunk.choices[0]?.delta?.content` |
| Anthropic SDK | `event.delta.text` |

### Data Flow

```
SDK text stream (textStream, graph.stream(), etc.)
         ↓
Text chunks: `{"name": "Jo` (incomplete JSON)
         ↓
┌─────────────────────────────────────┐
│       @stable-stream/core           │
│                                     │
│  1. parseIncremental() - chunks→obj │
│  2. hydrate() - schema→skeleton     │
│  3. strictMerge() - safe merge      │
│  4. Track state & changed paths     │
└─────────────────────────────────────┘
         ↓
    Type-safe, stable data for UI
```

### Package Structure

```
@stable-stream/core
├── parser/
│   └── incremental.ts      # Partial JSON → JS object
├── hydrate/
│   └── index.ts            # Schema → Skeleton (DONE)
├── merge/
│   └── strictMerge.ts      # Skeleton + Partial → Safe Result
├── stream/
│   └── createStream.ts     # Orchestrator
└── index.ts

@stable-stream/react (future)
├── useStableStream.ts      # React hook with RAF throttling
└── index.ts
```

---

## Current State

### Implemented
- [x] `hydrate()` - Schema to skeleton conversion
- [x] Primitive generators (string, number, boolean, date, null, undefined)
- [x] Collection generators (object, array, tuple)
- [x] Wrapper generators (optional, nullable, default, lazy, enum, nativeEnum)
- [x] Union handling (returns `null` as loading marker)
- [x] Depth limiting for recursive schemas (default: 3)

### Core Pipeline (Not Yet Implemented)

| Component | Priority | Description |
|-----------|----------|-------------|
| `parseIncremental()` | **P0** | JSON string chunks → partial JS object |
| `strictMerge()` | **P0** | Skeleton + partial → safe merged result |
| `createStableStream()` | **P0** | Orchestrator: parse → hydrate → merge → emit |
| `useStableStream` (React) | P1 | React hook with RAF throttling |
| Discriminated union hot-swap | P2 | Swap skeleton when discriminator arrives |

---

---

## Incremental JSON Parser

### Key Insight: Schema-Aware Parsing

Since we know the target schema, we don't need a general-purpose JSON fixer. We just need to:
1. Extract key-value pairs as they complete
2. Feed completed values to `strictMerge()`
3. Keep skeleton defaults for incomplete values

This is simpler than the general "fix incomplete JSON" problem.

### Edge Cases

| Case | Example | Solution |
|------|---------|----------|
| Incomplete string | `"name": "Jo` | Wait for unescaped `"` |
| Escape sequences | `"John \"Doc\""` | Track `\` escaping |
| Unicode escapes | `"\u0041"` | Parse 4 hex digits after `\u` |
| Incomplete number | `"age": 2` | Wait for `,` `}` `]` or whitespace |
| Nested objects | `{"user": {"name":` | Track `{` `}` depth |
| Nested arrays | `["a", "b` | Track `[` `]` depth |
| Partial keywords | `tru` / `fals` / `nul` | Match full `true`/`false`/`null` |

### Implementation Approach: Simple State Machine

**Decision:** Custom state machine (not formal DFA).

```typescript
// All the state we need
interface ParserState {
  inString: boolean;    // Inside a quoted string?
  escaped: boolean;     // Next char escaped?
  depth: number;        // Nesting level
  currentKey: string;   // Current key name
  buffer: string;       // Value accumulator
}
```

**Why not formal DFA:**
- We know the schema (huge simplification)
- Only extracting complete values, not validating JSON
- Simple loop + state variables handles all cases
- Easier to debug and maintain

**Why not regex:**
- Can't handle recursive nesting
- Can't track "inside string" state

**Why not JSON.parse:**
- Fails on incomplete input

---

## Key Improvements (Hydration)

### 1. Streaming State Markers (High Priority)

**Problem:** Current skeleton uses static defaults (`""`, `0`, `false`). UI cannot distinguish "not yet received" from "actually empty string from LLM".

**Current:**
```typescript
hydrate(z.object({ name: z.string() }))
// → { name: "" }
```

**Proposed Options:**

Option A - Metadata wrapper:
```typescript
hydrate(schema, { trackState: true })
// → { name: { __value: "", __state: "pending" } }
// After merge: { name: { __value: "John", __state: "received" } }
```

Option B - Symbol markers (zero serialization overhead):
```typescript
const PENDING = Symbol('pending');
// → { name: "", [PENDING]: true }
```

Option C - Separate state tree:
```typescript
hydrate(schema, { withStateTree: true })
// → {
//     data: { name: "" },
//     state: { name: "pending" }  // or Map for perf
//   }
```

**Decision:** TBD - needs prototyping

---

### 2. Path-Aware Merge (High Priority)

**Problem:** Naive merge re-traverses entire tree on every chunk. Research shows O(n²) vs O(n) is "the difference between a UI that feels broken and magical."

**Proposed:**
```typescript
interface MergeResult<T> {
  result: T;
  changedPaths: string[];      // ["user.name", "user.address.city"]
  completionRatio: number;     // 0.0 → 1.0
  discardedKeys: string[];     // Hallucinated keys that were dropped
}

strictMerge(skeleton, chunk): MergeResult<T>
```

**Benefits:**
- UI can subscribe to specific paths for granular re-renders
- Completion ratio enables progress indicators
- Discarded keys provide observability into LLM hallucinations

---

### 3. Array Handling Strategy (Medium Priority)

**Problem:** Arrays return `[]`. LLMs stream array items one-by-one. UI needs structure hints before items arrive.

**Current:**
```typescript
hydrate(z.array(itemSchema))
// → []
```

**Proposed Options:**

Option A - Schema hints:
```typescript
z.array(itemSchema).min(3)
// → [skeleton, skeleton, skeleton]  // Pre-fill with min count
```

Option B - Metadata descriptors:
```typescript
z.array(itemSchema).describe("@hint:length=5")
// → [skeleton, skeleton, skeleton, skeleton, skeleton]
```

Option C - Explicit option:
```typescript
hydrate(schema, { arrayHints: { "items": 3 } })
// Path-based hints for expected array lengths
```

**Decision:** TBD - Option A feels most natural if schema already has `.min()`

---

### 4. Discriminated Union Hot-Swap (Medium Priority)

**Problem:** Current implementation returns `null` for unions. Need smarter handling when discriminator arrives.

**Current:**
```typescript
const schema = z.discriminatedUnion("type", [CarSchema, BikeSchema]);
hydrate(schema)
// → null
```

**Proposed:**
```typescript
hydrate(schema)
// → {
//     __unionPending: true,
//     __discriminator: "type",
//     __options: ["car", "bike"],
//     // Pre-hydrate common fields across ALL variants
//     ...commonFieldsSkeleton
//   }
```

**Hot-swap flow:**
1. Initial: `{ __unionPending: true, type: null, ... }`
2. Stream arrives: `{ "type": "car" }`
3. Detect discriminator, call `hydrate(CarSchema)`
4. Swap skeleton, continue merging

**Complexity:** Need to introspect all union variants to find common fields.

---

### 5. String Streaming Support (Low Priority)

**Problem:** Long text fields (descriptions, summaries) show nothing until complete.

**Current:**
```typescript
hydrate(z.string())
// → ""
// Stays "" until full string received, then jumps to full text
```

**Proposed:**
```typescript
// Option: Mark strings as streamable
z.string().describe("@streamable")

// During streaming, allow partial updates:
// "" → "The" → "The quick" → "The quick brown fox"
```

**Note:** This may be out of scope - partial strings are handled at merge layer, not hydration.

---

### 6. Validation During Streaming (Low Priority)

**Problem:** Vercel AI SDK notes "partial outputs cannot be validated against schema."

**Proposed:**
```typescript
interface StreamState<T> {
  skeleton: T;                  // Full hydrated skeleton
  partial: Partial<T>;          // Raw streamed data
  merged: T;                    // skeleton + partial (display this)
  errors: ValidationError[];    // Real-time schema violations
  isComplete: boolean;
}
```

**Use case:** Show warnings if LLM is producing invalid data types mid-stream.

---

## Future Considerations

### A2UI Protocol Alignment

A2UI (Google) is a protocol for agent-driven interfaces. It defines:
- `createSurface` - Create rendering context
- `updateComponents` - Describe UI tree
- `updateDataModel` - Stream data to components
- `deleteSurface` - Cleanup

**Potential integration:** stable-stream could be the data layer implementation for A2UI's `updateDataModel`:

```typescript
// A2UI renderer using stable-stream internally
function handleUpdateDataModel(schema, chunk) {
  const skeleton = hydrate(schema);
  return strictMerge(skeleton, chunk);
}
```

**Status:** Deferred. Build independent library first, then explore A2UI adapter.

### Framework Adapters (Post-Core)

Once core is solid:
- `@stable-stream/react` - useStableStream hook
- `@stable-stream/vue` - composable
- `@stable-stream/svelte` - store-based

---

## Research References

- [Streaming AI responses and the incomplete JSON problem](https://www.aha.io/engineering/articles/streaming-ai-responses-incomplete-json) - O(n²) vs O(n) parsing
- [Structured Output Streaming for LLMs](https://medium.com/@prestonblckbrn/structured-output-streaming-for-llms-a836fc0d35a2) - tree-sitter approach
- [Progressive JSON (overreacted)](https://overreacted.io/progressive-json/) - Breadth-first streaming, Suspense boundaries
- [A2UI Protocol](https://a2ui.org/specification/v0.9-a2ui/) - Google's agent-to-UI protocol
- [Vercel AI SDK streamObject](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-object) - Partial object streaming (no validation)

---

## Open Questions

1. Should streaming state be opt-in or default?
2. How to handle recursive schemas in discriminated unions?
3. ~~Should we provide our own partial JSON parser or require external?~~ **RESOLVED: Include it.**
4. What's the right abstraction boundary between core and react packages?
5. How to handle non-JSON structured output (XML, YAML from some models)?

---

## Lessons Learned

### Scope Matters for Adoption

Original design focused on "unique value" (hydration + merge) and assumed parsing was someone else's problem. This is technically correct but creates adoption friction.

**Before:** "Use partial-json-parser, then use stable-stream, then use your UI framework"
**After:** "Use stable-stream. That's it."

The difference between a library and a solution.

### The Stack View

```
┌─────────────────────────────────────┐
│           UI Framework              │  ← React, Vue, Svelte
├─────────────────────────────────────┤
│  @stable-stream/react (future)      │  ← Framework binding
├─────────────────────────────────────┤
│       @stable-stream/core           │  ← THIS LIBRARY
│  ┌───────────────────────────────┐  │
│  │ createStableStream()          │  │  ← Orchestrator
│  │   ├── parseIncremental()      │  │  ← Partial JSON → object
│  │   ├── hydrate()               │  │  ← Schema → skeleton ✅
│  │   └── strictMerge()           │  │  ← Safe merge
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  LLM SDK (text stream)              │  ← Vercel AI, LangGraph, etc.
└─────────────────────────────────────┘
```

---

---

## Market Validation (2026)

### The Problem Still Exists

According to [Chris Schnabl's analysis](https://schnabl.cx/blog/streaming-structured-output.html), streaming structured output is **still broken in 2026** across all major providers:

- **OpenAI/Anthropic**: Stream partial JSON but require manual reconstruction
- **Gemini**: Only raw text chunks, no parsed output
- **Core issue**: Developers cannot distinguish default values from updated content

### What Exists Today

| Solution | What It Does | Gap |
|----------|--------------|-----|
| [Vercel AI SDK](https://vercel.com/docs/ai-sdk) `streamObject` | Returns `partialObjectStream` | No skeleton at T=0, no hallucination protection |
| [Hashbrown](https://hashbrown.dev/) | Streaming generative UI with Skillet schema | Custom schema language, not Zod |
| [llm-ui](https://llm-ui.com/) | React components for LLM output | Focused on markdown/code, not structured data |
| [CopilotKit](https://dev.to/copilotkit/the-developers-guide-to-generative-ui-in-2026-1bh3) | AG-UI protocol for generative UI | Higher-level abstraction, agent-focused |

### Where stable-stream Fits

**The gap:** SDKs give you partial objects, but:
- First render has `undefined` fields (crash risk)
- No protection against hallucinated keys
- No change tracking (which fields updated?)
- Layout shifts as fields appear

**stable-stream fills this gap:**

```
Vercel AI SDK          stable-stream              Your UI
─────────────────────────────────────────────────────────
textStream ──────────► createStableStream() ────► Typed, stable data
                       │
                       ├─ Skeleton at T=0 ✓
                       ├─ Hallucination protection ✓
                       ├─ Change tracking ✓
                       └─ Type safety ✓
```

### Generative UI Connection

The [Generative UI movement](https://generativeui.github.io/) (Google's A2UI, OpenAI's Open-JSON-UI) is about agents generating UI specs as JSON.

**stable-stream supports this:**
- Parse streaming UI specs with Zod schemas
- Ensure specs are type-safe during streaming
- Render UI components progressively without layout shift

Example: Agent streams A2UI JSON → stable-stream parses with schema → UI renders stable components

### Who Benefits

| Developer Type | Pain Point | How stable-stream Helps |
|----------------|------------|-------------------------|
| Building chat UIs | Partial data causes crashes | Typed skeleton from T=0 |
| Streaming forms/cards | Layout shifts as fields arrive | All fields exist immediately |
| Using structured output | LLM sends unexpected keys | Hallucination protection |
| Building generative UI | Need stable, typed UI specs | Schema-first parsing |

### Conclusion

**Yes, this project makes sense in 2026.** The streaming structured output problem is documented and unsolved at the SDK level. stable-stream provides the missing layer between raw streams and stable UIs.

**Unique positioning:** Not another LLM SDK, but a **post-processing layer** that works with any SDK to ensure type safety, stability, and hallucination protection.

---

*Last updated: 2026-02-02*
