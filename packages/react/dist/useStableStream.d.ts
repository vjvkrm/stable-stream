import { z } from 'zod';
import { type HydrateOptions } from '@stable-stream/core';
export interface UseStableStreamOptions<T extends z.ZodTypeAny> {
    /** Zod schema defining the expected shape */
    schema: T;
    /** Async iterable of JSON string chunks. Pass null/undefined to not start streaming. */
    source: AsyncIterable<string> | null | undefined;
    /** Hydration options (e.g., maxDepth) */
    hydrateOptions?: HydrateOptions;
    /** Throttle updates to animation frames (default: true) */
    throttle?: boolean;
    /** Called when streaming completes */
    onComplete?: (data: z.infer<T>) => void;
    /** Called on error */
    onError?: (error: Error) => void;
}
export interface UseStableStreamResult<T> {
    /** Current data (always complete shape from schema) */
    data: T;
    /** True while actively receiving chunks */
    isStreaming: boolean;
    /** True when stream has finished successfully */
    isComplete: boolean;
    /** Error if stream failed */
    error: Error | null;
    /** Paths that changed in the last update */
    changedPaths: string[];
    /** Reset to initial skeleton state */
    reset: () => void;
}
/**
 * React hook for streaming structured JSON from LLMs.
 *
 * Performance notes:
 * - Uses single state object to batch updates (1 re-render per update)
 * - RAF throttling limits to 60fps max
 * - Structural sharing from core ensures efficient reconciliation
 * - Callbacks stored in refs to avoid effect re-runs
 *
 * @example
 * ```tsx
 * const { data, isStreaming } = useStableStream({
 *   schema: UserSchema,
 *   source: textStream,
 * });
 *
 * return (
 *   <div>
 *     <h1>{data.name || 'Loading...'}</h1>
 *     {isStreaming && <Spinner />}
 *   </div>
 * );
 * ```
 */
export declare function useStableStream<T extends z.ZodTypeAny>(options: UseStableStreamOptions<T>): UseStableStreamResult<z.infer<T>>;
//# sourceMappingURL=useStableStream.d.ts.map