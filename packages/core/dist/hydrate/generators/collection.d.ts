import { z } from "zod";
import type { HydrateOptions } from "../index";
/**
 * Handles structural types and recursion.
 */
export declare function generateCollection(typeName: string, schema: z.ZodTypeAny, hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any, options: HydrateOptions, depth: number): any;
//# sourceMappingURL=collection.d.ts.map