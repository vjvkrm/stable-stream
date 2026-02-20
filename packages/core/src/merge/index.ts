import { z } from "zod";

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
  trackDiscarded: boolean,
  schema?: z.ZodTypeAny
): InternalResult {
  // Null/undefined source - keep target unchanged
  if (source === null || source === undefined) {
    return { value: target, changed: false };
  }

  // Target is null (union loading marker) - replace with source, but apply schema constraints if available
  if (target === null) {
    let safeSource = source;

    if (schema && isPlainObject(source)) {
      // If we have a schema and source is an object, we need to filter out hallucinated keys
      safeSource = filterBySchema(source as Record<string, unknown>, schema, path, discardedKeys, trackDiscarded);
    }

    if (path) {
      changedPaths.push(path);
    }
    return { value: safeSource, changed: true };
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
  trackDiscarded: boolean,
  schema?: z.ZodTypeAny
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
    
    // Resolve child schema if possible
    let childSchema: z.ZodTypeAny | undefined;
    if (schema) {
      childSchema = getChildSchema(schema, key);
    }

    const result = mergeValue(
      targetValue,
      sourceValue,
      childPath,
      changedPaths,
      discardedKeys,
      trackDiscarded,
      childSchema
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
  trackDiscarded: boolean,
  schema?: z.ZodTypeAny
): InternalResult {
  // Source must be array for array merge
  if (!Array.isArray(source)) {
    return { value: target, changed: false };
  }

  let anyChanged = false;
  const newArr: unknown[] = [];

  // Merge existing positions
  const maxLen = Math.max(target.length, source.length);
  
  // Resolve item schema if available
  let itemSchema: z.ZodTypeAny | undefined;
  if (schema) {
    itemSchema = getChildSchema(schema, 0); // Arrays usually have singular item type
  }

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
        trackDiscarded,
        itemSchema
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
      
      let itemVal = source[i];
      if (itemSchema && isPlainObject(itemVal)) {
        itemVal = filterBySchema(itemVal as Record<string, unknown>, itemSchema, childPath, discardedKeys, trackDiscarded);
      }
      
      newArr.push(itemVal);
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

/**
 * Gets allowed keys from an object schema, considering unions and intersections.
 */
function getAllowedKeys(schema: z.ZodTypeAny): Set<string> {
  const keys = new Set<string>();
  const typeName = (schema._def as any).typeName;

  if (typeName === z.ZodFirstPartyTypeKind.ZodObject) {
    const shape = (schema as z.ZodObject<any>).shape;
    Object.keys(shape).forEach(k => keys.add(k));
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodUnion || typeName === z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion) {
    const options = (schema as any)._def.options || (schema as any).options;
    if (Array.isArray(options)) {
      options.forEach(opt => {
        const optKeys = getAllowedKeys(opt);
        optKeys.forEach(k => keys.add(k));
      });
    }
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodIntersection) {
    const leftKeys = getAllowedKeys((schema as z.ZodIntersection<any, any>)._def.left);
    const rightKeys = getAllowedKeys((schema as z.ZodIntersection<any, any>)._def.right);
    leftKeys.forEach(k => keys.add(k));
    rightKeys.forEach(k => keys.add(k));
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodLazy) {
    return getAllowedKeys((schema as z.ZodLazy<any>)._def.getter());
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    return getAllowedKeys((schema as z.ZodEffects<any>)._def.schema);
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodOptional || typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
    return getAllowedKeys((schema as any).unwrap());
  }

  return keys;
}

/**
 * Resolves the child schema for a given key or index.
 */
function getChildSchema(schema: z.ZodTypeAny, keyOrIndex: string | number): z.ZodTypeAny | undefined {
  const typeName = (schema._def as any).typeName;

  if (typeName === z.ZodFirstPartyTypeKind.ZodObject && typeof keyOrIndex === 'string') {
    return (schema as z.ZodObject<any>).shape[keyOrIndex];
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodArray && typeof keyOrIndex === 'number') {
    return (schema as z.ZodArray<any>).element;
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodRecord && typeof keyOrIndex === 'string') {
    return (schema as z.ZodRecord<any>).element;
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodOptional || typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
    return getChildSchema((schema as any).unwrap(), keyOrIndex);
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodLazy) {
    return getChildSchema((schema as z.ZodLazy<any>)._def.getter(), keyOrIndex);
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    return getChildSchema((schema as z.ZodEffects<any>)._def.schema, keyOrIndex);
  } else if (typeName === z.ZodFirstPartyTypeKind.ZodUnion || typeName === z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion) {
    // In unions, we try to find a matching child schema in any of the options
    const options = (schema as any)._def.options || (schema as any).options;
    if (Array.isArray(options)) {
      for (const opt of options) {
        const child = getChildSchema(opt, keyOrIndex);
        if (child) return child;
      }
    }
  }

  return undefined;
}

/**
 * Filter an object by stripping any keys not permitted by the schema.
 * This is used for objects replacing a `null` loading marker.
 */
function filterBySchema(
  obj: Record<string, unknown>, 
  schema: z.ZodTypeAny, 
  path: string,
  discardedKeys: string[],
  trackDiscarded: boolean
): Record<string, unknown> {
  const typeName = (schema._def as any).typeName;
  
  // If it's a pass-through catch-all like ZodAny or ZodRecord, don't filter
  if (typeName === z.ZodFirstPartyTypeKind.ZodAny || typeName === z.ZodFirstPartyTypeKind.ZodRecord) {
    return obj;
  }

  const allowedKeys = getAllowedKeys(schema);
  
  // If the schema didn't yield any object keys (e.g. primitive), return as-is
  if (allowedKeys.size === 0) {
    return obj;
  }

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (allowedKeys.has(key)) {
      if (isPlainObject(value)) {
        const childSchema = getChildSchema(schema, key);
        if (childSchema) {
          filtered[key] = filterBySchema(value as Record<string, unknown>, childSchema, `${path}.${key}`, discardedKeys, trackDiscarded);
        } else {
          filtered[key] = value;
        }
      } else if (Array.isArray(value)) {
        const itemSchema = getChildSchema(schema, key);
        if (itemSchema) {
           filtered[key] = value.map((item, idx) => {
             if (isPlainObject(item)) {
                const arrItemSchema = getChildSchema(itemSchema, idx);
                if (arrItemSchema) {
                   return filterBySchema(item as Record<string, unknown>, arrItemSchema, `${path}.${key}[${idx}]`, discardedKeys, trackDiscarded);
                }
             }
             return item;
           });
        } else {
           filtered[key] = value;
        }
      } else {
        filtered[key] = value;
      }
    } else if (trackDiscarded) {
      discardedKeys.push(path ? `${path}.${key}` : key);
    }
  }

  return filtered;
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
 * @param schema - Overall Zod schema to guide hallucination protection for union resolutions
 * @returns New state with structural sharing
 */
export function applyParsedValue<T>(
  target: T,
  path: string,
  value: unknown,
  schema?: z.ZodTypeAny
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

  const result = applyAtPath(target, segments, 0, value, changedPaths, schema);

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
  changedPaths: string[],
  schema?: z.ZodTypeAny,
  currentSchema?: z.ZodTypeAny
): InternalResult {
  const segment = segments[index];
  const isLast = index === segments.length - 1;
  const activeSchema = currentSchema || schema;

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
      
      let newValue = value;
      
      const childSchema = activeSchema ? getChildSchema(activeSchema, key) : undefined;
      
      // If we are replacing a null target, we apply schema filtering to prevent hallucination bypass
      if (obj[key] === null && isPlainObject(newValue) && childSchema) {
         const fullPath = segments
            .slice(0, index + 1)
            .map((s) => (s.type === "index" ? `[${s.value}]` : s.value))
            .join(".")
            .replace(/\.\[/g, "[");
         newValue = filterBySchema(newValue as Record<string, unknown>, childSchema, fullPath, [], false);
      } else {
         const coerced = coerceType(obj[key], newValue);
         if (!coerced.compatible && obj[key] !== null) {
            return { value: target, changed: false };
         }
         newValue = coerced.value;
      }

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
    const childSchema = activeSchema ? getChildSchema(activeSchema, key) : undefined;
    const childResult = applyAtPath(
      obj[key],
      segments,
      index + 1,
      value,
      changedPaths,
      schema,
      childSchema
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
      const childSchema = activeSchema ? getChildSchema(activeSchema, idx) : undefined;

      if (newArr[idx] === null && isPlainObject(newValue) && childSchema) {
         const fullPath = segments
            .slice(0, index + 1)
            .map((s) => (s.type === "index" ? `[${s.value}]` : s.value))
            .join(".")
            .replace(/\.\[/g, "[");
         newValue = filterBySchema(newValue as Record<string, unknown>, childSchema, fullPath, [], false);
      } else if (newArr[idx] !== undefined) {
        const coerced = coerceType(newArr[idx], value);
        if (!coerced.compatible && newArr[idx] !== null) {
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
    const childSchema = activeSchema ? getChildSchema(activeSchema, idx) : undefined;
    const childResult = applyAtPath(
      arr[idx],
      segments,
      index + 1,
      value,
      changedPaths,
      schema,
      childSchema
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
