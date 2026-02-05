import { z } from "zod";
import { generatePrimitive } from "./generators/primitive";
import { generateCollection } from "./generators/collection";
import { generateWrapper } from "./generators/wrapper";
import { generateUnion } from "./generators/union";

export interface HydrateOptions {
  /**
   * Maximum depth for recursive schemas.
   * @default 3
   */
  maxDepth?: number;
}

/**
 * Generates a "Skeleton" object from a Zod schema.
 */
export function hydrate<T>(
  schema: z.ZodType<T>,
  options: HydrateOptions = {},
  depth = 0
): T {
  const { maxDepth = 3 } = options;

  if (depth > maxDepth) {
    return null as any;
  }

  const typeName = (schema._def as any).typeName as string;

  // 1. Check Primitives
  const primitiveResult = generatePrimitive(typeName, schema);
  if (primitiveResult !== undefined || typeName === "ZodUndefined" || typeName === "ZodNull") {
    return primitiveResult;
  }

  // 2. Check Wrappers/Enums (Optional, Nullable, Default, Lazy, Enum)
  const wrapperResult = generateWrapper(typeName, schema, hydrate, options, depth);
  if (wrapperResult !== undefined) {
    return wrapperResult;
  }

  // 3. Check Unions (Loading Markers)
  const unionResult = generateUnion(typeName, schema, hydrate, options, depth);
  if (unionResult !== undefined) {
    return unionResult;
  }

  // 4. Check Collections (Pass hydrate for recursion)
  const collectionResult = generateCollection(typeName, schema, hydrate, options, depth);
  if (collectionResult !== undefined) {
    return collectionResult;
  }

  // Fallback
  return {} as T;
}
