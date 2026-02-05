import { describe, it, expect } from "vitest";
import { strictMerge, applyParsedValue, trimSkeleton } from "./index";

describe("Strict Merge", () => {
  describe("Basic Merging", () => {
    it("should merge primitive values", () => {
      const target = { name: "", age: 0 };
      const source = { name: "John", age: 25 };

      const result = strictMerge(target, source);

      expect(result.data).toEqual({ name: "John", age: 25 });
      expect(result.changed).toBe(true);
      expect(result.changedPaths).toContain("name");
      expect(result.changedPaths).toContain("age");
    });

    it("should handle partial updates", () => {
      const target = { name: "", age: 0, active: false };
      const source = { name: "John" };

      const result = strictMerge(target, source);

      expect(result.data).toEqual({ name: "John", age: 0, active: false });
      expect(result.changed).toBe(true);
      expect(result.changedPaths).toEqual(["name"]);
    });

    it("should return same reference if no changes", () => {
      const target = { name: "John", age: 25 };
      const source = { name: "John", age: 25 };

      const result = strictMerge(target, source);

      expect(result.data).toBe(target); // Same reference
      expect(result.changed).toBe(false);
      expect(result.changedPaths).toEqual([]);
    });
  });

  describe("Nested Objects", () => {
    it("should merge nested objects", () => {
      const target = {
        user: { name: "", email: "" },
        settings: { theme: "light" },
      };
      const source = {
        user: { name: "John", email: "john@example.com" },
      };

      const result = strictMerge(target, source);

      expect(result.data.user.name).toBe("John");
      expect(result.data.user.email).toBe("john@example.com");
      expect(result.data.settings.theme).toBe("light");
      expect(result.changedPaths).toContain("user.name");
      expect(result.changedPaths).toContain("user.email");
    });

    it("should preserve structural sharing for unchanged branches", () => {
      const target = {
        user: { name: "", email: "" },
        settings: { theme: "light" },
      };
      const source = { user: { name: "John" } };

      const result = strictMerge(target, source);

      // Settings object should be the same reference
      expect(result.data.settings).toBe(target.settings);
    });

    it("should clone changed path only", () => {
      const target = {
        a: { b: { c: { d: "old" } } },
        x: { y: { z: "unchanged" } },
      };
      const source = { a: { b: { c: { d: "new" } } } };

      const result = strictMerge(target, source);

      // Changed path gets new references
      expect(result.data).not.toBe(target);
      expect(result.data.a).not.toBe(target.a);
      expect(result.data.a.b).not.toBe(target.a.b);
      expect(result.data.a.b.c).not.toBe(target.a.b.c);

      // Unchanged path keeps same reference
      expect(result.data.x).toBe(target.x);
      expect(result.data.x.y).toBe(target.x.y);
    });
  });

  describe("Hallucination Protection", () => {
    it("should discard keys not in target schema", () => {
      const target = { name: "", age: 0 };
      const source = {
        name: "John",
        age: 25,
        evil: "HACKED!",
        password: "secret",
      };

      const result = strictMerge(target, source, { trackDiscarded: true });

      expect(result.data).toEqual({ name: "John", age: 25 });
      expect(result.discardedKeys).toContain("evil");
      expect(result.discardedKeys).toContain("password");
      expect("evil" in result.data).toBe(false);
    });

    it("should discard nested unknown keys", () => {
      const target = {
        user: { name: "" },
      };
      const source = {
        user: { name: "John", ssn: "123-45-6789" },
        admin: true,
      };

      const result = strictMerge(target, source, { trackDiscarded: true });

      expect(result.data).toEqual({ user: { name: "John" } });
      expect(result.discardedKeys).toContain("admin");
      expect(result.discardedKeys).toContain("user.ssn");
    });

    it("should not track discarded by default (performance)", () => {
      const target = { name: "" };
      const source = { name: "John", extra: "ignored" };

      const result = strictMerge(target, source);

      expect(result.discardedKeys).toEqual([]);
    });
  });

  describe("Arrays", () => {
    it("should merge array elements", () => {
      const target = [
        { id: 0, name: "" },
        { id: 0, name: "" },
      ];
      const source = [
        { id: 1, name: "First" },
        { id: 2, name: "Second" },
      ];

      const result = strictMerge(target, source);

      expect(result.data).toEqual([
        { id: 1, name: "First" },
        { id: 2, name: "Second" },
      ]);
    });

    it("should accept new items beyond skeleton", () => {
      const target = [{ id: 0 }];
      const source = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const result = strictMerge(target, source);

      expect(result.data).toHaveLength(3);
      expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("should keep unfilled skeleton items", () => {
      const target = [
        { id: 0, name: "" },
        { id: 0, name: "" },
        { id: 0, name: "" },
      ];
      const source = [{ id: 1, name: "First" }];

      const result = strictMerge(target, source);

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toEqual({ id: 1, name: "First" });
      expect(result.data[1]).toEqual({ id: 0, name: "" }); // Skeleton
      expect(result.data[2]).toEqual({ id: 0, name: "" }); // Skeleton
    });

    it("should preserve structural sharing for unchanged array items", () => {
      const item1 = { id: 1, name: "First" };
      const item2 = { id: 2, name: "Second" };
      const target = [item1, item2];
      const source = [{ id: 1, name: "First" }, { id: 2, name: "Changed" }];

      const result = strictMerge(target, source);

      expect(result.data[0]).toBe(item1); // Same reference
      expect(result.data[1]).not.toBe(item2); // New reference
    });
  });

  describe("Type Coercion", () => {
    it("should coerce number strings to actual numbers", () => {
      const target = { count: 0, price: 0 };
      const source = { count: "42", price: "19.99" };

      const result = strictMerge(target, source);

      expect(result.data.count).toBe(42);
      expect(typeof result.data.count).toBe("number");
      expect(result.data.price).toBe(19.99);
      expect(typeof result.data.price).toBe("number");
    });

    it("should coerce boolean strings to actual booleans", () => {
      const target = { active: false, enabled: true };
      const source = { active: "true", enabled: "false" };

      const result = strictMerge(target, source);

      expect(result.data.active).toBe(true);
      expect(typeof result.data.active).toBe("boolean");
      expect(result.data.enabled).toBe(false);
      expect(typeof result.data.enabled).toBe("boolean");
    });

    it("should reject invalid number strings", () => {
      const target = { count: 0 };
      const source = { count: "not-a-number" };

      const result = strictMerge(target, source);

      expect(result.data.count).toBe(0); // Unchanged
      expect(result.changed).toBe(false);
    });

    it("should reject incompatible types", () => {
      const target = { name: "" };
      const source = { name: { nested: "object" } };

      const result = strictMerge(target, source);

      expect(result.data.name).toBe(""); // Unchanged
      expect(result.changed).toBe(false);
    });

    it("should handle null source gracefully", () => {
      const target = { name: "John" };
      const source = null;

      const result = strictMerge(target, source);

      expect(result.data).toBe(target);
      expect(result.changed).toBe(false);
    });
  });

  describe("Union Loading Markers", () => {
    it("should replace null target (union marker) with source value", () => {
      const target = { variant: null };
      const source = { variant: { type: "A", value: 123 } };

      const result = strictMerge(target, source);

      expect(result.data.variant).toEqual({ type: "A", value: 123 });
      expect(result.changedPaths).toContain("variant");
    });
  });
});

describe("Apply Parsed Value", () => {
  describe("Simple Paths", () => {
    it("should apply value at root key", () => {
      const target = { name: "", age: 0 };
      const result = applyParsedValue(target, "name", "John");

      expect(result.data).toEqual({ name: "John", age: 0 });
      expect(result.changed).toBe(true);
      expect(result.changedPaths).toEqual(["name"]);
    });

    it("should apply value at nested path", () => {
      const target = { user: { name: "", email: "" } };
      const result = applyParsedValue(target, "user.name", "John");

      expect(result.data).toEqual({ user: { name: "John", email: "" } });
      expect(result.changedPaths).toEqual(["user.name"]);
    });

    it("should apply value at array index", () => {
      const target = { items: ["", "", ""] };
      const result = applyParsedValue(target, "items[1]", "middle");

      expect(result.data).toEqual({ items: ["", "middle", ""] });
      expect(result.changedPaths).toEqual(["items[1]"]);
    });

    it("should apply value at nested array path", () => {
      const target = {
        rows: [
          { id: 0, name: "" },
          { id: 0, name: "" },
        ],
      };
      const result = applyParsedValue(target, "rows[0].name", "First");

      expect(result.data.rows[0].name).toBe("First");
      expect(result.data.rows[1].name).toBe("");
      expect(result.changedPaths).toEqual(["rows[0].name"]);
    });
  });

  describe("Structural Sharing", () => {
    it("should only clone changed path", () => {
      const target = {
        user: { name: "", profile: { bio: "" } },
        settings: { theme: "dark" },
      };
      const result = applyParsedValue(target, "user.name", "John");

      // Changed path: new references
      expect(result.data).not.toBe(target);
      expect(result.data.user).not.toBe(target.user);

      // Unchanged paths: same references
      expect(result.data.user.profile).toBe(target.user.profile);
      expect(result.data.settings).toBe(target.settings);
    });

    it("should not change reference if value is same", () => {
      const target = { name: "John" };
      const result = applyParsedValue(target, "name", "John");

      expect(result.data).toBe(target);
      expect(result.changed).toBe(false);
    });
  });

  describe("Hallucination Protection", () => {
    it("should ignore unknown paths", () => {
      const target = { name: "" };
      const result = applyParsedValue(target, "evil", "HACKED");

      expect(result.data).toBe(target);
      expect(result.changed).toBe(false);
    });

    it("should ignore deeply unknown paths", () => {
      const target = { user: { name: "" } };
      const result = applyParsedValue(target, "user.password", "secret");

      expect(result.data).toBe(target);
      expect(result.changed).toBe(false);
    });
  });

  describe("Array Extension", () => {
    it("should extend array for streaming items", () => {
      const target = { items: [] as string[] };
      const result = applyParsedValue(target, "items[0]", "first");

      expect(result.data.items).toEqual(["first"]);
      expect(result.changed).toBe(true);
    });

    it("should fill gaps with undefined", () => {
      const target = { items: ["a"] };
      const result = applyParsedValue(target, "items[3]", "d");

      expect(result.data.items).toEqual(["a", undefined, undefined, "d"]);
    });
  });

  describe("Complex Paths", () => {
    it("should handle mixed object and array access", () => {
      const target = {
        data: {
          rows: [
            { cells: [0, 0, 0] },
            { cells: [0, 0, 0] },
          ],
        },
      };
      const result = applyParsedValue(target, "data.rows[1].cells[2]", 42);

      expect(result.data.data.rows[1].cells[2]).toBe(42);
      expect(result.data.data.rows[0].cells).toBe(target.data.rows[0].cells);
    });
  });
});

describe("Edge Cases", () => {
  describe("NaN Handling", () => {
    it("should not report change when both values are NaN", () => {
      const target = { value: NaN };
      const source = { value: NaN };

      const result = strictMerge(target, source);

      expect(result.changed).toBe(false);
      expect(result.data).toBe(target);
    });

    it("should report change from NaN to number", () => {
      const target = { value: NaN };
      const source = { value: 42 };

      const result = strictMerge(target, source);

      expect(result.changed).toBe(true);
      expect(result.data.value).toBe(42);
    });
  });

  describe("Prototype Pollution Protection", () => {
    it("should not access prototype properties", () => {
      const target = { name: "" };
      const source = { name: "John", toString: "HACKED", constructor: "BAD" };

      const result = strictMerge(target, source, { trackDiscarded: true });

      expect(result.data).toEqual({ name: "John" });
      expect(result.discardedKeys).toContain("toString");
      expect(result.discardedKeys).toContain("constructor");
    });

    it("should ignore __proto__ in source", () => {
      const target = { name: "" };
      // Using Object.create to avoid direct __proto__ assignment
      const source = Object.assign(Object.create(null), {
        name: "John",
        __proto__: { admin: true },
      });

      const result = strictMerge(target, source);

      expect(result.data).toEqual({ name: "John" });
      expect((result.data as any).admin).toBeUndefined();
    });
  });

  describe("Empty Structures", () => {
    it("should handle empty objects", () => {
      const target = {};
      const source = { extra: "ignored" };

      const result = strictMerge(target, source, { trackDiscarded: true });

      expect(result.data).toEqual({});
      expect(result.changed).toBe(false);
      expect(result.discardedKeys).toContain("extra");
    });

    it("should handle empty arrays", () => {
      const target = { items: [] as string[] };
      const source = { items: [] };

      const result = strictMerge(target, source);

      expect(result.data.items).toEqual([]);
      expect(result.changed).toBe(false);
    });

    it("should handle empty source", () => {
      const target = { name: "John", age: 25 };
      const source = {};

      const result = strictMerge(target, source);

      expect(result.data).toBe(target);
      expect(result.changed).toBe(false);
    });
  });

  describe("Special Values", () => {
    it("should handle Infinity", () => {
      const target = { value: 0 };
      const source = { value: Infinity };

      const result = strictMerge(target, source);

      expect(result.data.value).toBe(Infinity);
      expect(result.changed).toBe(true);
    });

    it("should handle negative Infinity", () => {
      const target = { value: 0 };
      const source = { value: -Infinity };

      const result = strictMerge(target, source);

      expect(result.data.value).toBe(-Infinity);
    });

    it("should handle undefined source values (keep target)", () => {
      const target = { name: "John", age: 25 };
      const source = { name: undefined, age: 30 };

      const result = strictMerge(target, source);

      expect(result.data.name).toBe("John"); // Kept
      expect(result.data.age).toBe(30); // Updated
    });
  });

  describe("Deeply Nested", () => {
    it("should handle 10 levels of nesting", () => {
      const target = {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: "" } } } } } } } } },
      };
      const source = {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: "deep" } } } } } } } } },
      };

      const result = strictMerge(target, source);

      expect(result.data.a.b.c.d.e.f.g.h.i.j).toBe("deep");
      expect(result.changedPaths).toEqual(["a.b.c.d.e.f.g.h.i.j"]);
    });
  });
});

describe("Trim Skeleton", () => {
  it("should trim unfilled skeleton items", () => {
    const data = {
      rows: [
        { id: 1, name: "First" },
        { id: 2, name: "Second" },
        { id: 0, name: "" }, // Skeleton
        { id: 0, name: "" }, // Skeleton
        { id: 0, name: "" }, // Skeleton
      ],
    };
    const lengths = new Map([["rows", 2]]);

    const result = trimSkeleton(data, lengths);

    expect(result.rows).toHaveLength(2);
    expect(result.rows).toEqual([
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ]);
  });

  it("should preserve structural sharing when trimming", () => {
    const item1 = { id: 1 };
    const item2 = { id: 2 };
    const data = {
      rows: [item1, item2, { id: 0 }],
      other: { unchanged: true },
    };
    const lengths = new Map([["rows", 2]]);

    const result = trimSkeleton(data, lengths);

    expect(result.rows[0]).toBe(item1);
    expect(result.rows[1]).toBe(item2);
    expect(result.other).toBe(data.other);
  });

  it("should handle nested arrays", () => {
    const data = {
      tables: [
        { rows: [1, 2, 0, 0, 0] },
        { rows: [3, 4, 5, 0, 0] },
      ],
    };
    const lengths = new Map([
      ["tables[0].rows", 2],
      ["tables[1].rows", 3],
    ]);

    const result = trimSkeleton(data, lengths);

    expect(result.tables[0].rows).toEqual([1, 2]);
    expect(result.tables[1].rows).toEqual([3, 4, 5]);
  });

  it("should return same reference if no trimming needed", () => {
    const data = { rows: [1, 2, 3] };
    const lengths = new Map([["rows", 3]]);

    const result = trimSkeleton(data, lengths);

    expect(result).toBe(data);
  });

  it("should handle empty lengths map", () => {
    const data = { rows: [1, 2, 3] };
    const lengths = new Map<string, number>();

    const result = trimSkeleton(data, lengths);

    expect(result).toBe(data);
  });
});
