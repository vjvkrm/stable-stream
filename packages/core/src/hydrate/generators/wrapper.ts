import { z } from "zod";
import type { HydrateOptions } from "../index";

/**
 * Handles "Wrappers" that modify or contain other types.
 */
export function generateWrapper(
  typeName: string,
  schema: z.ZodTypeAny,
  hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any,
  options: HydrateOptions,
  depth: number
): any {
  const def = schema._def as any;

  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable: {
      // We UNWRAP and hydrate the inner type to maintain skeleton space.
      return hydrate(def.innerType, options, depth);
    }

    case z.ZodFirstPartyTypeKind.ZodDefault: {
      // If a default is explicitly set, we use it!
      return def.defaultValue();
    }

    case z.ZodFirstPartyTypeKind.ZodLazy: {
      // This is for recursive schemas. 
      // We call the function and hydrate the result.
      return hydrate(def.getter(), options, depth + 1);
    }

    case z.ZodFirstPartyTypeKind.ZodEnum: {
      // LLM Categories. Always pick the first one.
      return def.values[0];
    }

    case z.ZodFirstPartyTypeKind.ZodNativeEnum: {
      // Native TS Enums can have reverse mappings for numbers.
      // We want to pick the first "real" value.
      const values = Object.values(def.values);
      // Filter out keys of numeric enums (keys are strings that map to numbers)
      const actualValues = values.filter(v => typeof v === 'number');
      if (actualValues.length > 0) return actualValues[0];
      return values[0];
    }

    default:
      return undefined;
  }
}
