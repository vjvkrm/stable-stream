# Hydration Engine: Challenges & Solutions (LLM Edition)

This document outlines the specific challenges of converting non-deterministic `ZodSchema` definitions into deterministic UI Skeletons, specifically for **LLM Structured Output (JSON)**.

## 1. The Recursive Loop (Stack Overflow)
**Context:** LLMs often generate recursive structures (e.g., nested comments).
**Problem:** A schema that references itself causes infinite recursion if not checked.
**Solution:** `DepthLimiter`.
- Pass a `depth` counter to every recursive call.
- Check: `if (depth > MAX_DEPTH) return [] (or null)`.
- Default Limit: 3.

## 2. The Schrödinger Case (Unions)
**Context:** LLMs vary their output structure based on "type" fields.
**Problem:** `z.union([z.string(), z.number()])`.
We cannot return `""` because the final value might be `100`.
**Solution:** `Indeterminate State`.
- Return `null` (if nullable).
- OR: Return the **First Option's** default (best effort).
- **Discriminated Unions:** Even harder. We start with a "Loading" skeleton until the discriminator key arrives in the stream.

## 3. The Enumeration Trap
**Context:** LLMs are asked to pick categories.
**Problem:** `z.enum(["ADMIN", "USER"])`.
Returning `""` (empty string) is **invalid**. It MUST be one of the options.
**Solution:** `First Option Default`.
- Always return the first element: `schema.options[0]` (e.g., "ADMIN").

## 4. Fixed Structures (Tuples)
**Context:** LLMs generating [x, y] coordinates.
**Problem:** `z.tuple([z.number(), z.number()])`.
Returning `[]` (empty array) breaks code expecting `data[1]`.
**Solution:** `Greedy Fill`.
- Iterate the tuple definition and hydrate *each* item.
- Result: `[0, 0]`.

## 5. Defaults vs Optionals
**Context:** LLMs often omit optional fields.
**Problem:** `z.string().default("hello")` vs `z.string().optional()`.
**Solution:**
- **Default:** MUST use the provided default value (`"hello"`).
- **Optional:** MUST hydrate the inner type (`""`) to reserve UI space (Skeleton Mode), rather than returning `undefined`. This prevents UI layout shift when the field eventually arrives (or doesn't).

## 6. The "Any/Unknown" (Hallucination Risk)
**Context:** Weakly typed parts of the schema.
**Problem:** `z.any()` or `z.unknown()`.
**Solution:** Return `null` (Safest bet).

## Out of Scope (Non-JSON)
Since LLMs generate JSON, we **explicitly ignore**:
- `z.map()`, `z.set()` (Not Standard JSON).
- `z.promise()`, `z.function()` (Not Serializable).
- `z.transform()` (Cannot run logic on partial streams).
