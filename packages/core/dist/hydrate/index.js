import { z } from "zod";
import { generatePrimitive } from "./generators/primitive";
import { generateCollection } from "./generators/collection";
import { generateWrapper } from "./generators/wrapper";
import { generateUnion } from "./generators/union";
/**
 * Generates a "Skeleton" object from a Zod schema.
 */
export function hydrate(schema, options = {}, depth = 0) {
    const { maxDepth = 3 } = options;
    if (depth > maxDepth) {
        return null;
    }
    const typeName = schema._def.typeName;
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
    return {};
}
//# sourceMappingURL=index.js.map