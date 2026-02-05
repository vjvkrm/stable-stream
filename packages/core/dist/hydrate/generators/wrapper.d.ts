import { z } from "zod";
import type { HydrateOptions } from "../index";
/**
 * Handles "Wrappers" that modify or contain other types.
 */
export declare function generateWrapper(typeName: string, schema: z.ZodTypeAny, hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any, options: HydrateOptions, depth: number): any;
//# sourceMappingURL=wrapper.d.ts.map