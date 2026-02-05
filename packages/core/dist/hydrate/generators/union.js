import { z } from "zod";
/**
 * Handles Union types.
 * According to PRD, these return a "Loading Marker" (null) initially.
 */
export function generateUnion(typeName, schema, hydrate, options, depth) {
    const def = schema._def;
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
//# sourceMappingURL=union.js.map