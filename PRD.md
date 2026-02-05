# Product Requirements Document (PRD): Stable Stream

**Version:** 2.0.0
**Status:** Ready for Engineering
**Architecture:** Monorepo (Core Engine + Framework Adapters)

## 1. Problem Statement

When streaming structured JSON from LLMs to a UI, developers face three critical issues:

1. **Crash Risk:** `undefined` errors when accessing deep keys before they arrive in the stream.
2. **Layout Shift (CLS):** UI elements "pop" into existence one by one, degrading UX.
3. **Hallucinations:** LLMs sending random "ghost keys" that pollute state and crash validation logic.

**Solution:** An end-to-end streaming engine that:
- Parses raw LLM streams (handles incomplete JSON)
- Generates a full, type-safe skeleton at T=0 from a Zod schema
- Strictly merges incoming data while discarding hallucinated keys

**Result:** Zero layout shift. 100% type safety. Hallucination protection.

## 2. Core Principle: Simple Input, Stable Output

Accepts any text stream from any LLM SDK. Handles parsing, hydration, and merge.

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
│  3. Strict Merge (safe merge)       │
└─────────────────────────────────────┘
         ↓
    Type-safe, stable data for UI
```

**Works with any SDK:** Vercel AI SDK's `textStream`, LangGraph's `graph.stream()`, or any `AsyncIterable<string>`.

## 3. System Architecture

### 3.1 Package A: @stable-stream/core (The Engine)

**Environment:** Isomorphic (Node.js, Browser, Edge).
**Dependencies:** `zod` (Peer Dependency). Zero UI dependencies.

**Modules:**

| Module | Responsibility |
|--------|---------------|
| `parser/` | Incremental JSON parsing for incomplete streams |
| `hydrate/` | Generate typed skeleton from Zod schema |
| `merge/` | Target-first merge with hallucination protection |
| `stream/` | Orchestrator: ties everything together |

**Public API:**

```typescript
// Main entry point
export function createStableStream<T>(options: {
  schema: ZodSchema<T>;
  source: string | AsyncIterable<string>;  // JSON string chunks
}): AsyncIterable<{ data: T; state: StreamState }>;

// Lower-level utilities (also exported)
export function hydrate<T>(schema: ZodSchema<T>, options?: HydrateOptions): T;
export function strictMerge<T>(skeleton: T, partial: unknown): MergeResult<T>;
```

### 3.2 Package B: @stable-stream/react (The Adapter)

**Environment:** Browser / React (Client Side).
**Dependencies:** `react`, `@stable-stream/core`.

**Responsibilities:**
- Lifecycle management (Mount/Unmount)
- Frame Throttling: Buffer chunks and render once per animation frame (~16ms)
- Shadow State: (Future V2) Handle user edits during streaming

**Public API:**

```typescript
export function useStableStream<T>(options: {
  schema: ZodSchema<T>;
  source: string | AsyncIterable<string> | null;  // JSON string chunks
}): {
  data: T;
  state: StreamState;
};
```

## 4. Detailed Functional Specifications

### Feature A: Incremental JSON Parser

**Goal:** Parse incomplete JSON as it streams.

**Input:** `{"name": "Jo` (incomplete)
**Output:** `{ name: "Jo" }` (valid partial object)

**Requirements:**
- O(n) incremental parsing (not O(n²) reparse from start)
- Maintain consistent types (string stays string)
- Handle nested objects and arrays

### Feature B: The hydrate Engine

**Goal:** Generate a complete skeleton object from a Zod schema.

**Input:** `ZodSchema<T>`
**Output:** `T` (The Skeleton - fully populated with defaults)

**Rules Table:**

| Zod Type | Skeleton Value | Note |
|:---------|:---------------|:-----|
| `z.string()` | `""` | Empty string |
| `z.number()` | `0` | Zero |
| `z.boolean()` | `false` | |
| `z.array()` | `[]` | Empty array |
| `z.array().min(n)` | `[skeleton × n]` | Pre-fill n items to prevent CLS |
| `z.date()` | `new Date()` | Current timestamp |
| `z.object()` | `{ ...keys }` | Recursively fill all keys |
| `z.optional()` | `ChildDefault` | Fill to hold UI space |
| `z.nullable()` | `ChildDefault` | Fill to hold UI space |
| `z.union()` | `null` | Loading marker |
| `z.discriminatedUnion()` | `null` | Loading marker (hot-swap later) |
| `z.enum()` | `options[0]` | First enum value |
| `z.default(val)` | `val` | Respect user defaults |
| `z.lazy()` | Recurse with depth limit | Handles recursive schemas |

**Safety Constraint:** Depth limiter stops at configurable depth (default: 3) to prevent stack overflow on recursive schemas.

### Feature C: The strictMerge Algorithm

**Goal:** Merge stream data into skeleton without altering schema structure.

**Algorithm:** Target-First Traversal

1. Iterate over **Skeleton Keys** (the "boss")
2. If `Stream[Key]` exists → Recurse or Update value
3. If `Stream[Key]` is missing → Keep Skeleton value
4. If `Stream` has extra keys → **DISCARD** (hallucination protection)

**Type Guarding:** If Skeleton expects `number` but Stream sends `"12"` (string), attempt safe coercion or discard.

**Return Value:**

```typescript
interface MergeResult<T> {
  result: T;              // Merged data
  changedPaths: string[]; // ["user.name", "user.age"]
  discardedKeys: string[];// ["hackerKey", "randomField"]
}
```

### Feature D: Union State Machine

**Goal:** Handle discriminated unions gracefully.

**Logic:**

1. **Phase 1 (Indeterminate):** Skeleton has `null` for union fields
2. **Phase 2 (Detection):** Stream chunk arrives with discriminator (e.g., `{"type": "car"}`)
3. **Phase 3 (Hot Swap):** Detect discriminator, call `hydrate(CarSchema)`, replace skeleton, continue merging

### Feature E: createStableStream Orchestrator

**Goal:** Tie everything together into a simple async iterable.

```typescript
const stream = createStableStream({ schema, source });

for await (const { data, state } of stream) {
  // data: T - always complete shape
  // state.isComplete: boolean
  // state.completionRatio: number (0.0 -> 1.0)
  // state.changedPaths: string[]
  // state.discardedKeys: string[]
}
```

### Feature F: useStableStream Hook (React)

**Goal:** React-friendly wrapper with frame throttling.

```typescript
const { data, state } = useStableStream({ schema, source });

// - Renders skeleton immediately at T=0
// - Updates at most once per animation frame (60fps)
// - Cleans up on unmount
```

## 5. User Experience

### What the Developer Writes

```typescript
function UserProfile({ llmStream }) {
  const { data, state } = useStableStream({
    schema: UserSchema,
    source: llmStream,
  });

  return (
    <div>
      <h1>{data.name || "Loading..."}</h1>
      <p>Age: {data.age || "—"}</p>
      <p>{data.bio || "..."}</p>
      {state.isComplete && <button>Save</button>}
    </div>
  );
}
```

### What the End User Sees

```
T=0: All fields visible with placeholders (skeleton)
     ┌─────────────────────┐
     │ Loading...          │
     │ Age: —              │
     │ ...                 │
     └─────────────────────┘

T=1: Name fills in (nothing moves)
     ┌─────────────────────┐
     │ John                │
     │ Age: —              │
     │ ...                 │
     └─────────────────────┘

T=2: Complete (nothing moved, button appears)
     ┌─────────────────────┐
     │ John                │
     │ Age: 25             │
     │ Software Engineer   │
     │ [Save]              │
     └─────────────────────┘
```

**Zero layout shift. Content fills in progressively.**

## 6. Acceptance Criteria

### 6.1 End-to-End Test

- **Given:** JSON string chunks from any LLM SDK (e.g., `{"name": "Jo` then `hn"}`)
- **When:** Passed to `createStableStream` with a Zod schema
- **Then:** Yields typed, complete objects on each chunk; `isComplete` becomes true at end

### 6.2 Layout Shift Test

- **Given:** A form with Name, Age, and Bio fields
- **When:** Stream starts (latency 500ms)
- **Then:** Full form renders at T=0; button position never moves

### 6.3 Type Safety Test

- **Given:** TypeScript codebase using the library
- **When:** Developer hovers over `data.user.age`
- **Then:** Type is `number`, NOT `number | undefined`

### 6.4 Hallucination Test

- **Given:** LLM stream sends `{ "credit_card": "1234" }` (not in schema)
- **Then:** `data` object never contains `credit_card`; it appears in `state.discardedKeys`

### 6.5 Incremental Parse Test

- **Given:** Stream of 1000 chunks
- **Then:** Parse time grows linearly O(n), not quadratically O(n²)

## 7. Out of Scope

- **Non-JSON formats:** XML, YAML (future consideration)
- **Bi-directional streaming:** User input during stream (V2)
- **Non-Zod schemas:** Only Zod supported initially
- **Server-side rendering:** Focus on client-side streaming UX
