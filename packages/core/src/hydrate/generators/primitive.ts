import { z } from "zod";

/**
 * Handles basic atoms like strings, numbers, and booleans.
 */
export function generatePrimitive(typeName: string, schema: z.ZodTypeAny): any {
  switch (typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return "";
    
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return 0;
    
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return false;
    
    case z.ZodFirstPartyTypeKind.ZodDate:
      return new Date();
    
    case z.ZodFirstPartyTypeKind.ZodNull:
      return null;
    
    case z.ZodFirstPartyTypeKind.ZodUndefined:
      return undefined;

    default:
      return undefined;
  }
}
