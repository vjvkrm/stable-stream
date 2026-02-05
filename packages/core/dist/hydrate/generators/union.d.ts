import { z } from "zod";
import type { HydrateOptions } from "../index";
/**
 * Handles Union types.
 * According to PRD, these return a "Loading Marker" (null) initially.
 */
export declare function generateUnion(typeName: string, schema: z.ZodTypeAny, hydrate: (schema: z.ZodTypeAny, options: HydrateOptions, depth: number) => any, options: HydrateOptions, depth: number): any;
//# sourceMappingURL=union.d.ts.map