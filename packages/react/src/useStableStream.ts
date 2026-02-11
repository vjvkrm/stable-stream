import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { z } from 'zod';
import {
  createStableStream,
  hydrate,
  type HydrateOptions,
  type StreamCompletionReason,
} from '@stable-stream/core';

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
  /** True when stream ended with incomplete JSON or errored before full completion */
  isPartial: boolean;
  /** Machine-readable completion status for diagnostics */
  completionReason: StreamCompletionReason | null;
  /** Error if stream failed */
  error: Error | null;
  /** Paths that changed in the last update */
  changedPaths: string[];
  /** Reset to initial skeleton state */
  reset: () => void;
}

// Combined state to reduce re-renders (single setState call)
interface StreamState<T> {
  data: T;
  isStreaming: boolean;
  isComplete: boolean;
  isPartial: boolean;
  completionReason: StreamCompletionReason | null;
  error: Error | null;
  changedPaths: string[];
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
export function useStableStream<T extends z.ZodTypeAny>(
  options: UseStableStreamOptions<T>
): UseStableStreamResult<z.infer<T>> {
  const { schema, source, hydrateOptions, throttle = true, onComplete, onError } = options;

  // Memoize initial skeleton to avoid recreating on every render
  const initialSkeleton = useMemo(
    () => hydrate(schema, hydrateOptions),
    [schema, hydrateOptions]
  );

  // Single state object for atomic updates (reduces re-renders)
  const [state, setState] = useState<StreamState<z.infer<T>>>(() => ({
    data: initialSkeleton,
    isStreaming: false,
    isComplete: false,
    isPartial: false,
    completionReason: null,
    error: null,
    changedPaths: [],
  }));

  // Store callbacks in refs to avoid effect dependency changes
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  // Track if component is mounted
  const mountedRef = useRef(true);
  // Track pending RAF update
  const rafRef = useRef<number | null>(null);
  // Pending data for RAF throttling
  const pendingUpdateRef = useRef<Partial<StreamState<z.infer<T>>> | null>(null);

  const clearPendingFrame = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearPendingFrame();
    const skeleton = hydrate(schema, hydrateOptions);
    setState({
      data: skeleton,
      isStreaming: false,
      isComplete: false,
      isPartial: false,
      completionReason: null,
      error: null,
      changedPaths: [],
    });
  }, [schema, hydrateOptions, clearPendingFrame]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPendingFrame();
    };
  }, [clearPendingFrame]);

  // Main streaming effect
  useEffect(() => {
    // No source - don't start streaming
    if (!source) {
      return;
    }

    // Reset state for new stream (single setState = single re-render)
    const skeleton = hydrate(schema, hydrateOptions);
    setState({
      data: skeleton,
      isStreaming: true,
      isComplete: false,
      isPartial: false,
      completionReason: null,
      error: null,
      changedPaths: [],
    });

    let aborted = false;

    const runStream = async () => {
      try {
        const stream = createStableStream({
          schema,
          source,
          hydrateOptions,
        });

        for await (const update of stream) {
          if (aborted || !mountedRef.current) break;

          if (update.state === 'error' && update.error) {
            clearPendingFrame();
            setState(prev => ({
              ...prev,
              error: update.error!,
              isStreaming: false,
              isPartial: update.isPartial,
              completionReason: update.completionReason,
            }));
            onErrorRef.current?.(update.error);
            break;
          }

          if (update.state === 'complete') {
            // Final update - bypass throttle, ensure data is set
            clearPendingFrame();
            setState({
              data: update.data,
              isStreaming: false,
              isComplete: true,
              isPartial: update.isPartial,
              completionReason: update.completionReason,
              error: null,
              changedPaths: [],
            });
            onCompleteRef.current?.(update.data);
            continue;
          }

          // Streaming update (with optional RAF throttling)
          if (throttle) {
            pendingUpdateRef.current = {
              data: update.data,
              isPartial: update.isPartial,
              completionReason: update.completionReason,
              changedPaths: update.changedPaths,
            };

            if (!rafRef.current) {
              rafRef.current = requestAnimationFrame(() => {
                if (mountedRef.current && pendingUpdateRef.current) {
                  setState(prev => ({
                    ...prev,
                    ...pendingUpdateRef.current,
                  }));
                  pendingUpdateRef.current = null;
                }
                rafRef.current = null;
              });
            }
          } else {
            setState(prev => ({
              ...prev,
              data: update.data,
              isPartial: update.isPartial,
              completionReason: update.completionReason,
              changedPaths: update.changedPaths,
            }));
          }
        }
      } catch (err) {
        if (aborted || !mountedRef.current) return;

        clearPendingFrame();
        const error = err instanceof Error ? err : new Error(String(err));
        setState(prev => ({
          ...prev,
          error,
          isStreaming: false,
          isPartial: true,
          completionReason: 'source_error',
        }));
        onErrorRef.current?.(error);
      }
    };

    runStream();

    return () => {
      aborted = true;
      clearPendingFrame();
    };
  }, [source, schema, hydrateOptions, throttle, clearPendingFrame]); // Note: callbacks removed from deps

  return {
    data: state.data,
    isStreaming: state.isStreaming,
    isComplete: state.isComplete,
    isPartial: state.isPartial,
    completionReason: state.completionReason,
    error: state.error,
    changedPaths: state.changedPaths,
    reset,
  };
}
