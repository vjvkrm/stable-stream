# Implementation Plan: Stable Stream

## Overview

Build a streaming engine that accepts any text stream and outputs stable, typed data for UIs.

```
Text Stream (from any SDK) → Parse → Hydrate → Merge → Typed Data
```

## Phase 1: Core Foundation

### Goal
Complete the `@stable-stream/core` package with all essential modules.

### 1.1 Incremental JSON Parser

**Location:** `packages/core/src/parser/`

**Approach:** Since we know the target schema, we don't need a full JSON parser. We need a lightweight state machine that extracts key-value pairs as they complete.

**Key Insight:** We have the skeleton from `hydrate()`. We just need to detect when values are complete and extract them - not reconstruct valid JSON.

**Tasks:**
- [ ] Implement state machine for key-value extraction
- [ ] Detect complete vs incomplete values
- [ ] Handle edge cases (see below)
- [ ] Unit tests for all edge cases

**Edge Cases to Handle:**

| Case | Example | Challenge |
|------|---------|-----------|
| Incomplete string | `{"name": "Jo` | Wait for closing quote |
| Escape sequences | `{"name": "John \"Doc\" Smith"}` | Don't treat `\"` as end of string |
| Unicode escapes | `{"name": "John \u0041"}` | Parse `\uXXXX` correctly |
| Incomplete number | `{"age": 2` | Is it `2` or start of `25`? Wait for delimiter |
| Nested objects | `{"user": {"name": "Jo` | Track brace depth |
| Nested arrays | `{"tags": ["a", "b` | Track bracket depth |
| Null/boolean | `{"active": tru` | Wait for complete keyword |
| Empty values | `{"name": ""}` | Valid empty string vs incomplete |

**Detection Rules:**
- String complete: closing `"` not preceded by odd number of `\`
- Number complete: followed by `,` `}` `]` or whitespace
- Boolean/null complete: full keyword matched
- Object/array complete: matching closing brace/bracket at same depth

**Implementation: Simple State Machine**

No formal DFA needed. Simple state tracking is sufficient:

```typescript
interface ParserState {
  inString: boolean;      // Are we inside a string?
  escaped: boolean;       // Is next char escaped?
  depth: number;          // Nesting depth (or use stack for type tracking)
  currentKey: string;     // Key being parsed
  buffer: string;         // Value being accumulated
}
```

**Core Loop:**

```typescript
for (const char of chunk) {
  if (state.escaped) {
    state.buffer += char;
    state.escaped = false;
    continue;
  }

  if (char === '\\' && state.inString) {
    state.escaped = true;
    state.buffer += char;
    continue;
  }

  if (char === '"') {
    state.inString = !state.inString;
    if (!state.inString) {
      // String complete - emit if it's a value
    }
    continue;
  }

  if (!state.inString) {
    if (char === '{' || char === '[') state.depth++;
    if (char === '}' || char === ']') state.depth--;

    if (char === ',' || char === '}' || char === ']') {
      // Value complete at this depth - emit key:value
    }
  }
}
```

**Why Not Formal DFA:**
- We know the schema (huge simplification)
- Only need to extract complete values, not validate JSON
- Simple state tracking handles all our edge cases
- Easier to debug and maintain

### 1.2 Hydrate Engine (Mostly Complete)

**Location:** `packages/core/src/hydrate/`

**Tasks:**
- [x] Primitive generators (string, number, boolean, date)
- [x] Collection generators (object, array, tuple)
- [x] Wrapper generators (optional, nullable, default, lazy, enum)
- [x] Union handling (null as loading marker)
- [x] Depth limiting
- [ ] **Array pre-fill with `.min()`** - Read Zod's `.min(n)` and pre-fill n skeleton items
- [ ] Add streaming state markers (optional enhancement)

**Array Pre-fill Logic:**
```typescript
// Schema
z.array(LineSchema).min(50)

// hydrate() detects .min(50) and returns:
[skeleton, skeleton, skeleton, ...]  // 50 items

// This prevents CLS for arrays up to 50 items
// Items beyond 50 append normally (acceptable CLS)
```

### 1.3 Strict Merge Algorithm

**Location:** `packages/core/src/merge/`

**Tasks:**
- [ ] Target-first traversal (skeleton keys are "boss")
- [ ] Hallucination protection (discard unknown keys)
- [ ] Type coercion/guarding
- [ ] Return changed paths and discarded keys
- [ ] Unit tests for merge scenarios

### 1.4 Stream Orchestrator

**Location:** `packages/core/src/stream/`

**Tasks:**
- [ ] `createStableStream()` function
- [ ] Wire up: parser → hydrate → merge
- [ ] Emit `{ data, state }` on each chunk
- [ ] Handle stream completion
- [ ] Error handling and cleanup

### Verification

```bash
pnpm test
```

- Parser tests: Incomplete JSON → valid partial object
- Hydrate tests: Schema → skeleton (existing)
- Merge tests: Skeleton + partial → safe result
- Integration tests: Full pipeline with mock streams

---

## Phase 2: React Integration

### Goal
Create `@stable-stream/react` with a simple hook API.

### 2.1 useStableStream Hook

**Location:** `packages/react/src/`

**Tasks:**
- [ ] Create package structure
- [ ] Implement `useStableStream` hook
- [ ] Handle mount/unmount lifecycle
- [ ] Frame throttling with `requestAnimationFrame`
- [ ] Return `{ data, state }` with proper types

### 2.2 Testing

- [ ] Integration tests with React Testing Library
- [ ] Layout shift verification
- [ ] Memory leak tests (unmount during stream)

---

## Phase 3: Advanced Features

### 3.1 Discriminated Union Hot-Swap
- [ ] Detect discriminator in stream
- [ ] Swap skeleton when type is known
- [ ] Continue merging with new schema

### 3.2 Array Handling
- [ ] Support `.min()` hints for pre-filling arrays
- [ ] Append mode for streaming array items

### 3.3 Streaming State Markers
- [ ] Track which fields are "pending" vs "received"
- [ ] Expose completion ratio

---

## Package Structure

```
@stable-stream/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── parser/
│   │   │   │   └── incremental.ts
│   │   │   ├── hydrate/
│   │   │   │   ├── index.ts          ✅ Done
│   │   │   │   └── generators/       ✅ Done
│   │   │   ├── merge/
│   │   │   │   └── strictMerge.ts
│   │   │   ├── stream/
│   │   │   │   └── createStream.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── react/
│       ├── src/
│       │   ├── useStableStream.ts
│       │   └── index.ts
│       └── package.json
├── package.json
├── turbo.json
└── tsconfig.base.json
```

---

## Priority Order

| Priority | Module | Reason |
|----------|--------|--------|
| P0 | Incremental Parser | Foundation for everything |
| P0 | Strict Merge | Core value prop (hallucination protection) |
| P0 | Stream Orchestrator | Ties everything together |
| P1 | React Hook | Developer experience |
| P2 | Union Hot-Swap | Advanced feature |
| P2 | Array Handling | Advanced feature |
