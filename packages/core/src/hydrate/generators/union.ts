import { z } from "zod";
import type { HydrateOptions } from "../index";

/**
 * Handles Union types.
 * According to PRD, these return a "Loading Marker" (null) initially.
 */
export function generateUnion(
  typeName: string,
  _schema: z.ZodTypeAny,
  _hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any,
  _options: HydrateOptions,
  _depth: number
): any {
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
