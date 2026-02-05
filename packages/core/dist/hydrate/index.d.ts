import { z } from "zod";
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
export declare function hydrate<T>(schema: z.ZodType<T>, options?: HydrateOptions, depth?: number): T;
//# sourceMappingURL=index.d.ts.map