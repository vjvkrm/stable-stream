/**
 * Strict Merge Algorithm with Structural Sharing
 *
 * Key principles:
 * 1. Target-first traversal - only visit paths that exist in skeleton
 * 2. Hallucination protection - discard keys not in skeleton
 * 3. Structural sharing - clone only changed paths, reuse unchanged
 * 4. Track changes - return which paths were modified
 */
export interface MergeResult<T> {
    /** The merged data (new reference if changed, same if unchanged) */
    data: T;
    /** Whether any changes occurred */
    changed: boolean;
    /** Paths that were updated (dot notation, e.g., "user.name", "items[0].price") */
    changedPaths: string[];
    /** Keys from source that were discarded (not in schema) */
    discardedKeys: string[];
}
export interface MergeOptions {
    /** Track discarded keys for debugging (default: false for performance) */
    trackDiscarded?: boolean;
}
/**
 * Strictly merge source into target using structural sharing.
 * Only allows keys that exist in target (schema-defined skeleton).
 *
 * @param target - The hydrated skeleton (defines allowed structure)
 * @param source - Partial data from parser (may contain unknown keys)
 * @param options - Merge options
 * @returns MergeResult with new data and change tracking
 */
export declare function strictMerge<T>(target: T, source: unknown, options?: MergeOptions): MergeResult<T>;
/**
 * Apply a single parsed value to the target at the given path.
 * Uses structural sharing - only clones the path to the changed value.
 *
 * @param target - Current state
 * @param path - Dot/bracket notation path (e.g., "user.name", "items[0].price")
 * @param value - Value to set
 * @returns New state with structural sharing
 */
export declare function applyParsedValue<T>(target: T, path: string, value: unknown): MergeResult<T>;
/**
 * Trim unfilled skeleton items from arrays when stream completes.
 * Call this after the final merge to remove pre-filled skeleton items
 * that weren't populated by actual data.
 *
 * @param data - The merged data
 * @param actualArrayLengths - Map of array paths to their actual lengths from stream
 * @returns Trimmed data with structural sharing
 */
export declare function trimSkeleton<T>(data: T, actualArrayLengths: Map<string, number>): T;
//# sourceMappingURL=index.d.ts.map