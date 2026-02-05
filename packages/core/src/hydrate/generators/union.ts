import { z } from "zod";
import type { HydrateOptions } from "../index";

/**
 * Handles Union types.
 * According to PRD, these return a "Loading Marker" (null) initially.
 */
export function generateUnion(
  typeName: string,
  schema: z.ZodTypeAny,
  hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any,
  options: HydrateOptions,
  depth: number
): any {
  const def = schema._def as any;

  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodUnion:
    case z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      // PRD Feature C: Phase 1 (Indeterminate)
      // Returns null as a "Loading Marker"
      return null;
    }

    default:
      return undefined;
  }
}
