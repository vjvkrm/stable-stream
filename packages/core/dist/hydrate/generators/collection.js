import { z } from "zod";
/**
 * Handles structural types and recursion.
 */
export function generateCollection(typeName, schema, hydrate, options, depth) {
    const def = schema._def;
    switch (typeName) {
        case z.ZodFirstPartyTypeKind.ZodObject: {
            const shape = def.shape();
            const result = {};
            for (const key in shape) {
                result[key] = hydrate(shape[key], options, depth + 1);
            }
            return result;
        }
        case z.ZodFirstPartyTypeKind.ZodArray: {
            // Check for .min() constraint to pre-fill array
            const minLength = def.minLength?.value || 0;
            if (minLength > 0) {
                const itemSchema = def.type;
                // Pre-fill with skeleton items to prevent CLS
                return Array.from({ length: minLength }, () => hydrate(itemSchema, options, depth + 1));
            }
            // No min specified - empty array
            return [];
        }
        case z.ZodFirstPartyTypeKind.ZodTuple: {
            const items = def.items || [];
            return items.map((item) => hydrate(item, options, depth + 1));
        }
        default:
            return undefined;
    }
}
//# sourceMappingURL=collection.js.map