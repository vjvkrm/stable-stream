import { describe, it, expect } from "vitest";
import { z } from "zod";
import { hydrate } from "./index";

describe("Hydrate Engine", () => {
  describe("Primitives", () => {
    it("should hydrate strings to empty string", () => {
      expect(hydrate(z.string())).toBe("");
    });

    it("should hydrate numbers to 0", () => {
      expect(hydrate(z.number())).toBe(0);
    });

    it("should hydrate booleans to false", () => {
      expect(hydrate(z.boolean())).toBe(false);
    });

    it("should hydrate dates to a Date object", () => {
      expect(hydrate(z.date())).toBeInstanceOf(Date);
    });

    it("should handle null and undefined", () => {
      expect(hydrate(z.null())).toBe(null);
      expect(hydrate(z.undefined())).toBe(undefined);
    });
  });

  describe("Collections", () => {
    it("should hydrate objects recursively", () => {
      const schema = z.object({
        name: z.string(),
        meta: z.object({
          id: z.number(),
        }),
      });
      expect(hydrate(schema)).toEqual({
        name: "",
        meta: { id: 0 },
      });
    });

    it("should hydrate arrays to empty array", () => {
      expect(hydrate(z.array(z.string()))).toEqual([]);
    });

    it("should pre-fill arrays with .min() constraint", () => {
      const schema = z.array(z.string()).min(3);
      const result = hydrate(schema);
      expect(result).toHaveLength(3);
      expect(result).toEqual(["", "", ""]);
    });

    it("should pre-fill arrays of objects with .min()", () => {
      const RowSchema = z.object({
        id: z.number(),
        name: z.string(),
      });
      const schema = z.array(RowSchema).min(2);
      const result = hydrate(schema);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { id: 0, name: "" },
        { id: 0, name: "" },
      ]);
    });

    it("should handle .min(0) as empty array", () => {
      const schema = z.array(z.string()).min(0);
      expect(hydrate(schema)).toEqual([]);
    });

    it("should pre-fill nested arrays with .min()", () => {
      const schema = z.object({
        rows: z.array(z.object({
          value: z.number(),
        })).min(5),
      });
      const result = hydrate(schema);
      expect(result.rows).toHaveLength(5);
      expect(result.rows[0]).toEqual({ value: 0 });
    });

    it("should hydrate tuples with correct types", () => {
      const schema = z.tuple([z.string(), z.number()]);
      expect(hydrate(schema)).toEqual(["", 0]);
    });
  });

  describe("Wrappers & Logic", () => {
    it("should unwrap optionals and hydrate inner type", () => {
      expect(hydrate(z.string().optional())).toBe("");
    });

    it("should unwrap nullables and hydrate inner type", () => {
      expect(hydrate(z.string().nullable())).toBe("");
    });

    it("should use default value if provided", () => {
      expect(hydrate(z.string().default("Hello"))).toBe("Hello");
    });

    it("should pick the first value for Enums", () => {
      expect(hydrate(z.enum(["A", "B"]))).toBe("A");
    });

    it("should handle Native Enums", () => {
      enum State { Active, Inactive }
      expect(hydrate(z.nativeEnum(State))).toBe(State.Active);
    });

    it("should handle Unions (Returns null as Loading Marker)", () => {
      const schema = z.union([z.string(), z.number()]);
      expect(hydrate(schema)).toBe(null);
    });
  });

  describe("Safety & Edge Cases", () => {
    it("should respect maxDepth and return null", () => {
      const schema = z.object({
        a: z.object({
          b: z.object({
            c: z.object({
              d: z.string()
            })
          })
        })
      });
      // At depth 4 (starting from 0, object key 'a' is d:1, 'b' is d:2, 'c' is d:3, 'd' is d:4)
      // Actually 'a' is depth 1 inside hydrate.
      const result = hydrate(schema, { maxDepth: 2 });
      expect(result.a.b.c).toBe(null);
    });

    it("should handle lazy/recursive schemas with depth limit", () => {
      type Category = { name: string; sub: Category[] };
      const schema: z.ZodType<Category> = z.lazy(() => 
        z.object({
          name: z.string(),
          sub: z.array(schema)
        })
      );

      const result = hydrate(schema);
      expect(result.name).toBe("");
      expect(result.sub).toEqual([]);
    });
  });
});
