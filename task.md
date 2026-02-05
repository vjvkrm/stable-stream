# Tasks: Stable Stream

## Phase 1: Core Engine (P0)

### 1.1 Incremental JSON Parser
- [x] Research parser options (partial-json-parser, tree-sitter, custom) → Custom state machine
- [x] Implement state machine for value extraction
- [x] Handle incomplete strings, objects, arrays
- [x] Ensure O(n) parsing complexity
- [x] Unit tests (48 tests passing, see [parser-test-cases.md](./parser-test-cases.md))

### 1.2 Hydrate Engine
- [x] Primitive generators (string, number, boolean, date, null, undefined)
- [x] Collection generators (object, array, tuple)
- [x] Wrapper generators (optional, nullable, default, lazy, enum, nativeEnum)
- [x] Union handling (null as loading marker)
- [x] Depth limiting for recursive schemas
- [x] Array pre-fill: detect `.min(n)` and generate n skeleton items

### 1.3 Strict Merge Algorithm
- [x] Target-first traversal implementation
- [x] Hallucination protection (discard unknown keys)
- [x] Type coercion/guarding (string→number, string→boolean)
- [x] Track changed paths
- [x] Track discarded keys
- [x] Structural sharing (React-compatible)
- [x] Trim skeleton on completion
- [x] Unit tests (46 tests passing)

### 1.4 Stream Orchestrator
- [x] `createStableStream()` function
- [x] Wire up: parser → hydrate → merge
- [x] Emit `{ data, state, changedPaths }` on each chunk
- [x] Stream completion handling (with skeleton trimming)
- [x] Error handling
- [x] `consumeStableStream()` helper
- [x] Unit tests (12 tests passing)

### 1.5 Core Integration Tests
- [x] End-to-end test with mock JSON stream
- [x] Hallucination protection test
- [x] Type safety verification (coercion)
- [x] Visual demo (form + table streaming)
- [x] Integration tests (11 tests passing)

---

## Phase 2: React Integration (P1)

### 2.1 Package Setup
- [x] Create `packages/react` structure
- [x] Configure package.json with react peer dep

### 2.2 useStableStream Hook
- [x] Implement hook with proper types
- [x] Handle mount/unmount lifecycle
- [x] Frame throttling with requestAnimationFrame
- [x] Cleanup on unmount
- [x] `reset()` function
- [x] `onComplete` / `onError` callbacks

### 2.3 React Tests
- [x] Integration tests with React Testing Library (3 tests)
- [x] Skeleton hydration verification
- [x] Array pre-fill verification

---

## Phase 3: Advanced Features (P2)

### 3.1 Discriminated Union Hot-Swap
- [ ] Detect discriminator arrival in stream
- [ ] Swap skeleton with correct variant
- [ ] Continue merging

### 3.2 Enhanced Array Handling
- [ ] Support `.min()` hints for pre-filling
- [ ] Streaming append mode

### 3.3 Streaming State Markers
- [ ] Track pending vs received fields
- [ ] Expose completion ratio
- [ ] Optional state tree

---

## Documentation

- [x] README.md - Project overview and usage
- [x] PRD.md - Product requirements (v2.0)
- [x] exploration.md - Research, roadmap, and market validation
- [x] implementation_plan.md - Technical plan
- [x] hydration_challenges.md - LLM-specific edge cases
- [x] parser-test-cases.md - 65 test cases for incremental parser
