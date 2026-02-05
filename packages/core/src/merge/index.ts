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
export function strictMerge<T>(
  target: T,
  source: unknown,
  options: MergeOptions = {}
): MergeResult<T> {
  const changedPaths: string[] = [];
  const discardedKeys: string[] = [];
  const trackDiscarded = options.trackDiscarded ?? false;

  const result = mergeValue(
    target,
    source,
    "",
    changedPaths,
    discardedKeys,
    trackDiscarded
  );

  return {
    data: result.value as T,
    changed: result.changed,
    changedPaths,
    discardedKeys,
  };
}

interface InternalResult {
  value: unknown;
  changed: boolean;
}

function mergeValue(
  target: unknown,
  source: unknown,
  path: string,
  changedPaths: string[],
  discardedKeys: string[],
  trackDiscarded: boolean
): InternalResult {
  // Null/undefined source - keep target unchanged
  if (source === null || source === undefined) {
    return { value: target, changed: false };
  }

  // Target is null (union loading marker) - replace with source
  if (target === null) {
    if (path) {
      changedPaths.push(path);
    }
    return { value: source, changed: true };
  }

  // Handle arrays
  if (Array.isArray(target)) {
    return mergeArray(
      target,
      source,
      path,
      changedPaths,
      discardedKeys,
      trackDiscarded
    );
  }

  // Handle objects
  if (isPlainObject(target) && isPlainObject(source)) {
    return mergeObject(
      target as Record<string, unknown>,
      source as Record<string, unknown>,
      path,
      changedPaths,
      discardedKeys,
      trackDiscarded
    );
  }

  // Handle primitives
  return mergePrimitive(target, source, path, changedPaths);
}

function mergeObject(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  path: string,
  changedPaths: string[],
  discardedKeys: string[],
  trackDiscarded: boolean
): InternalResult {
  let anyChanged = false;
  const newObj: Record<string, unknown> = {};

  // Track discarded keys (keys in source but not in target)
  if (trackDiscarded) {
    for (const key of Object.keys(source)) {
      if (!Object.hasOwn(target, key)) {
        const fullPath = path ? `${path}.${key}` : key;
        discardedKeys.push(fullPath);
      }
    }
  }

  // Target-first traversal: only process keys that exist in target (own properties only)
  for (const key of Object.keys(target)) {
    const targetValue = target[key];
    const sourceValue = source[key];
    const childPath = path ? `${path}.${key}` : key;

    const result = mergeValue(
      targetValue,
      sourceValue,
      childPath,
      changedPaths,
      discardedKeys,
      trackDiscarded
    );

    if (result.changed) {
      anyChanged = true;
      newObj[key] = result.value;
    } else {
      // Structural sharing: reuse unchanged value reference
      newObj[key] = targetValue;
    }
  }

  // If nothing changed, return original target reference
  if (!anyChanged) {
    return { value: target, changed: false };
  }

  return { value: newObj, changed: true };
}

function mergeArray(
  target: unknown[],
  source: unknown,
  path: string,
  changedPaths: string[],
  discardedKeys: string[],
  trackDiscarded: boolean
): InternalResult {
  // Source must be array for array merge
  if (!Array.isArray(source)) {
    return { value: target, changed: false };
  }

  let anyChanged = false;
  const newArr: unknown[] = [];

  // Merge existing positions
  const maxLen = Math.max(target.length, source.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path}[${i}]`;

    if (i < target.length && i < source.length) {
      // Both have value at this index - merge them
      const result = mergeValue(
        target[i],
        source[i],
        childPath,
        changedPaths,
        discardedKeys,
        trackDiscarded
      );

      if (result.changed) {
        anyChanged = true;
        newArr.push(result.value);
      } else {
        newArr.push(target[i]);
      }
    } else if (i < source.length) {
      // Source has more items than target skeleton
      // For streaming arrays, we accept new items beyond skeleton
      anyChanged = true;
      newArr.push(source[i]);
      changedPaths.push(childPath);
    } else {
      // Target has unfilled skeleton items
      // Keep them (will be trimmed on completion)
      newArr.push(target[i]);
    }
  }

  if (!anyChanged) {
    return { value: target, changed: false };
  }

  return { value: newArr, changed: true };
}

function mergePrimitive(
  target: unknown,
  source: unknown,
  path: string,
  changedPaths: string[]
): InternalResult {
  // Coerce and validate type compatibility
  const coerced = coerceType(target, source);
  if (coerced.compatible === false) {
    return { value: target, changed: false };
  }

  const newValue = coerced.value;

  // Handle NaN comparison (NaN !== NaN)
  if (typeof target === "number" && typeof newValue === "number") {
    if (Number.isNaN(target) && Number.isNaN(newValue)) {
      return { value: target, changed: false };
    }
  }

  // Value hasn't changed
  if (target === newValue) {
    return { value: target, changed: false };
  }

  changedPaths.push(path);
  return { value: newValue, changed: true };
}

interface CoercionResult {
  compatible: boolean;
  value: unknown;
}

/**
 * Coerce source type to match target type.
 * Allows LLM type coercion within safe bounds.
 * Returns the coerced value if compatible.
 */
function coerceType(target: unknown, source: unknown): CoercionResult {
  const targetType = typeof target;
  const sourceType = typeof source;

  // Same type - no coercion needed
  if (targetType === sourceType) {
    return { compatible: true, value: source };
  }

  // Allow number string -> number (LLMs sometimes quote numbers)
  if (targetType === "number" && sourceType === "string") {
    const parsed = Number(source);
    if (!isNaN(parsed)) {
      return { compatible: true, value: parsed };
    }
    return { compatible: false, value: source };
  }

  // Allow boolean strings -> boolean
  if (targetType === "boolean" && sourceType === "string") {
    const s = (source as string).toLowerCase();
    if (s === "true") {
      return { compatible: true, value: true };
    }
    if (s === "false") {
      return { compatible: true, value: false };
    }
    return { compatible: false, value: source };
  }

  return { compatible: false, value: source };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/**
 * Apply a single parsed value to the target at the given path.
 * Uses structural sharing - only clones the path to the changed value.
 *
 * @param target - Current state
 * @param path - Dot/bracket notation path (e.g., "user.name", "items[0].price")
 * @param value - Value to set
 * @returns New state with structural sharing
 */
export function applyParsedValue<T>(
  target: T,
  path: string,
  value: unknown
): MergeResult<T> {
  const changedPaths: string[] = [];

  // Parse path into segments
  const segments = parsePath(path);

  if (segments.length === 0) {
    return {
      data: target,
      changed: false,
      changedPaths: [],
      discardedKeys: [],
    };
  }

  const result = applyAtPath(target, segments, 0, value, changedPaths);

  return {
    data: result.value as T,
    changed: result.changed,
    changedPaths,
    discardedKeys: [],
  };
}

function applyAtPath(
  target: unknown,
  segments: PathSegment[],
  index: number,
  value: unknown,
  changedPaths: string[]
): InternalResult {
  const segment = segments[index];
  const isLast = index === segments.length - 1;

  if (segment.type === "key") {
    // Object key access
    if (!isPlainObject(target)) {
      return { value: target, changed: false };
    }

    const obj = target as Record<string, unknown>;
    const key = segment.value as string;

    // Key not in target (hallucination protection) - own properties only
    if (!Object.hasOwn(obj, key)) {
      return { value: target, changed: false };
    }

    if (isLast) {
      // Apply value at this key with type coercion
      const coerced = coerceType(obj[key], value);
      if (!coerced.compatible) {
        return { value: target, changed: false };
      }

      const newValue = coerced.value;
      if (obj[key] === newValue) {
        return { value: target, changed: false };
      }

      const fullPath = segments
        .slice(0, index + 1)
        .map((s) => (s.type === "index" ? `[${s.value}]` : s.value))
        .join(".")
        .replace(/\.\[/g, "[");

      changedPaths.push(fullPath);

      // Clone object with new value (structural sharing)
      return {
        value: { ...obj, [key]: newValue },
        changed: true,
      };
    }

    // Recurse into child
    const childResult = applyAtPath(
      obj[key],
      segments,
      index + 1,
      value,
      changedPaths
    );

    if (!childResult.changed) {
      return { value: target, changed: false };
    }

    // Clone object with new child (structural sharing)
    return {
      value: { ...obj, [key]: childResult.value },
      changed: true,
    };
  } else {
    // Array index access
    if (!Array.isArray(target)) {
      return { value: target, changed: false };
    }

    const arr = target as unknown[];
    const idx = segment.value as number;

    if (isLast) {
      // Apply value at this index
      // Extend array if necessary (streaming may add items)
      const newArr = [...arr];

      // Fill with undefined if needed
      while (newArr.length <= idx) {
        newArr.push(undefined);
      }

      // Type coercion if there's an existing value to coerce against
      let newValue = value;
      if (newArr[idx] !== undefined) {
        const coerced = coerceType(newArr[idx], value);
        if (!coerced.compatible) {
          return { value: target, changed: false };
        }
        newValue = coerced.value;
      }

      if (newArr[idx] === newValue) {
        return { value: target, changed: false };
      }

      const fullPath = segments
        .slice(0, index + 1)
        .map((s) => (s.type === "index" ? `[${s.value}]` : s.value))
        .join(".")
        .replace(/\.\[/g, "[");

      changedPaths.push(fullPath);
      newArr[idx] = newValue;

      return { value: newArr, changed: true };
    }

    // Index out of bounds
    if (idx >= arr.length) {
      return { value: target, changed: false };
    }

    // Recurse into child
    const childResult = applyAtPath(
      arr[idx],
      segments,
      index + 1,
      value,
      changedPaths
    );

    if (!childResult.changed) {
      return { value: target, changed: false };
    }

    // Clone array with new child (structural sharing)
    const newArr = [...arr];
    newArr[idx] = childResult.value;

    return { value: newArr, changed: true };
  }
}

interface PathSegment {
  type: "key" | "index";
  value: string | number;
}

/**
 * Parse a path string into segments.
 * Supports: "foo", "foo.bar", "foo[0]", "foo[0].bar", "foo.bar[1].baz"
 */
function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let current = "";
  let i = 0;

  while (i < path.length) {
    const char = path[i];

    if (char === ".") {
      if (current) {
        segments.push({ type: "key", value: current });
        current = "";
      }
      i++;
    } else if (char === "[") {
      if (current) {
        segments.push({ type: "key", value: current });
        current = "";
      }
      // Find closing bracket
      const end = path.indexOf("]", i);
      if (end === -1) break;
      const idx = parseInt(path.slice(i + 1, end), 10);
      segments.push({ type: "index", value: idx });
      i = end + 1;
    } else {
      current += char;
      i++;
    }
  }

  if (current) {
    segments.push({ type: "key", value: current });
  }

  return segments;
}

/**
 * Trim unfilled skeleton items from arrays when stream completes.
 * Call this after the final merge to remove pre-filled skeleton items
 * that weren't populated by actual data.
 *
 * @param data - The merged data
 * @param actualArrayLengths - Map of array paths to their actual lengths from stream
 * @returns Trimmed data with structural sharing
 */
export function trimSkeleton<T>(
  data: T,
  actualArrayLengths: Map<string, number>
): T {
  if (actualArrayLengths.size === 0) {
    return data;
  }

  return trimValue(data, "", actualArrayLengths) as T;
}

function trimValue(
  value: unknown,
  path: string,
  lengths: Map<string, number>
): unknown {
  if (Array.isArray(value)) {
    const actualLength = lengths.get(path);
    let arr = value;

    // Trim array if we know its actual length
    if (actualLength !== undefined && actualLength < value.length) {
      arr = value.slice(0, actualLength);
    }

    // Recursively trim nested arrays/objects
    let anyChildChanged = false;
    const newArr: unknown[] = [];

    for (let i = 0; i < arr.length; i++) {
      const childPath = path ? `${path}[${i}]` : `[${i}]`;
      const trimmed = trimValue(arr[i], childPath, lengths);
      if (trimmed !== arr[i]) {
        anyChildChanged = true;
      }
      newArr.push(trimmed);
    }

    if (anyChildChanged || arr.length !== value.length) {
      return newArr;
    }
    return value;
  }

  if (isPlainObject(value)) {
    let anyChanged = false;
    const newObj: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      const childPath = path ? `${path}.${key}` : key;
      const trimmed = trimValue(value[key], childPath, lengths);
      if (trimmed !== value[key]) {
        anyChanged = true;
      }
      newObj[key] = trimmed;
    }

    if (anyChanged) {
      return newObj;
    }
    return value;
  }

  return value;
}
