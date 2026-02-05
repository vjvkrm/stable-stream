/**
 * Stream Orchestrator
 *
 * Wires together: Parser → Hydrate → Merge
 * Emits stable, type-safe data on each chunk.
 */

import { z } from "zod";
import { hydrate, type HydrateOptions } from "../hydrate";
import { createIncrementalParser } from "../parser";
import { applyParsedValue, trimSkeleton } from "../merge";

export type StreamState = "streaming" | "complete" | "error";

export interface StreamUpdate<T> {
  /** Current merged data (always complete skeleton shape) */
  data: T;
  /** Stream state */
  state: StreamState;
  /** Paths that changed in this update */
  changedPaths: string[];
  /** Error if state is "error" */
  error?: Error;
}

export interface StableStreamOptions<T extends z.ZodTypeAny> {
  /** Zod schema defining the expected shape */
  schema: T;
  /** Async iterable of JSON string chunks */
  source: AsyncIterable<string>;
  /** Hydration options (e.g., maxDepth) */
  hydrateOptions?: HydrateOptions;
  /** Called on each update (alternative to async iteration) */
  onUpdate?: (update: StreamUpdate<z.infer<T>>) => void;
}

/**
 * Create a stable stream that parses, hydrates, and merges JSON chunks.
 *
 * @example
 * ```ts
 * const stream = createStableStream({
 *   schema: UserSchema,
 *   source: textStream, // AsyncIterable<string> from LLM SDK
 * });
 *
 * for await (const { data, state } of stream) {
 *   console.log(data); // Always complete shape, progressively filled
 * }
 * ```
 */
export async function* createStableStream<T extends z.ZodTypeAny>(
  options: StableStreamOptions<T>
): AsyncGenerator<StreamUpdate<z.infer<T>>> {
  const { schema, source, hydrateOptions, onUpdate } = options;

  // 1. Hydrate schema to create initial skeleton
  let data = hydrate(schema, hydrateOptions) as z.infer<T>;

  // 2. Create parser instance
  const parser = createIncrementalParser();

  // Track array lengths for trimming on completion
  const arrayLengths = new Map<string, number>();

  try {
    // 3. Process each chunk
    for await (const chunk of source) {
      const parsedValues = parser.process(chunk);

      if (parsedValues.length === 0) {
        continue; // No complete values yet
      }

      // 4. Merge each parsed value
      let anyChanged = false;
      const allChangedPaths: string[] = [];

      for (const { path, value } of parsedValues) {
        const result = applyParsedValue(data, path, value);

        if (result.changed) {
          data = result.data;
          anyChanged = true;
          allChangedPaths.push(...result.changedPaths);

          // Track array lengths for trimming
          trackArrayLength(path, arrayLengths);
        }
      }

      // 5. Emit update if changed
      if (anyChanged) {
        const update: StreamUpdate<z.infer<T>> = {
          data,
          state: "streaming",
          changedPaths: allChangedPaths,
        };

        if (onUpdate) {
          onUpdate(update);
        }

        yield update;
      }
    }

    // 6. Stream complete - trim unfilled skeleton items
    data = trimSkeleton(data, arrayLengths);

    const finalUpdate: StreamUpdate<z.infer<T>> = {
      data,
      state: "complete",
      changedPaths: [],
    };

    if (onUpdate) {
      onUpdate(finalUpdate);
    }

    yield finalUpdate;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    const errorUpdate: StreamUpdate<z.infer<T>> = {
      data,
      state: "error",
      changedPaths: [],
      error,
    };

    if (onUpdate) {
      onUpdate(errorUpdate);
    }

    yield errorUpdate;
  }
}

/**
 * Track array lengths from parsed paths.
 * Used to trim unfilled skeleton items on completion.
 */
function trackArrayLength(path: string, lengths: Map<string, number>): void {
  // Extract array path and index from paths like "items[0]", "rows[5].name"
  const arrayMatch = path.match(/^(.+?)\[(\d+)\]/);

  if (arrayMatch) {
    const arrayPath = arrayMatch[1];
    const index = parseInt(arrayMatch[2], 10);
    const currentMax = lengths.get(arrayPath) ?? -1;

    if (index >= currentMax) {
      lengths.set(arrayPath, index + 1);
    }
  }

  // Handle nested arrays: "data.tables[0].rows[3].value" -> track "data.tables[0].rows"
  const nestedMatches = path.matchAll(/(.+?\[\d+\](?:\.[^[]+)?)\[(\d+)\]/g);
  for (const match of nestedMatches) {
    const arrayPath = match[1];
    const index = parseInt(match[2], 10);
    const currentMax = lengths.get(arrayPath) ?? -1;

    if (index >= currentMax) {
      lengths.set(arrayPath, index + 1);
    }
  }
}

/**
 * Helper to consume a stable stream and return final data.
 * Useful for simple cases where you just want the result.
 *
 * @example
 * ```ts
 * const data = await consumeStableStream({
 *   schema: UserSchema,
 *   source: textStream,
 * });
 * ```
 */
export async function consumeStableStream<T extends z.ZodTypeAny>(
  options: Omit<StableStreamOptions<T>, "onUpdate">
): Promise<z.infer<T>> {
  let finalData: z.infer<T> | undefined;

  for await (const { data, state, error } of createStableStream(options)) {
    finalData = data;

    if (state === "error" && error) {
      throw error;
    }
  }

  if (finalData === undefined) {
    throw new Error("Stream ended without data");
  }

  return finalData;
}
