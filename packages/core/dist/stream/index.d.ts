/**
 * Stream Orchestrator
 *
 * Wires together: Parser → Hydrate → Merge
 * Emits stable, type-safe data on each chunk.
 */
import { z } from "zod";
import { type HydrateOptions } from "../hydrate";
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
export declare function createStableStream<T extends z.ZodTypeAny>(options: StableStreamOptions<T>): AsyncGenerator<StreamUpdate<z.infer<T>>>;
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
export declare function consumeStableStream<T extends z.ZodTypeAny>(options: Omit<StableStreamOptions<T>, "onUpdate">): Promise<z.infer<T>>;
//# sourceMappingURL=index.d.ts.map