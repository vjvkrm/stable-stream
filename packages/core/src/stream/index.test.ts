import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createStableStream, consumeStableStream } from "./index";

// Helper to create async iterable from chunks
async function* chunksToStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("Stream Orchestrator", () => {
  describe("Basic Streaming", () => {
    it("should hydrate schema and emit initial skeleton shape", async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const updates: any[] = [];
      const stream = createStableStream({
        schema,
        source: chunksToStream(['{"name": "John", "age": 25}']),
        onUpdate: (u) => updates.push(u),
      });

      for await (const update of stream) {
        // All updates should have complete shape
        expect(update.data).toHaveProperty("name");
        expect(update.data).toHaveProperty("age");
      }

      expect(updates.length).toBeGreaterThan(0);
    });

    it("should progressively fill data as chunks arrive", async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      });

      const chunks = ['{"name": "Jo', 'hn", "email": "john@example.com"}'];

      const updates: any[] = [];
      for await (const update of createStableStream({
        schema,
        source: chunksToStream(chunks),
      })) {
        updates.push({ ...update });
      }

      // Should have streaming updates + complete
      const streamingUpdates = updates.filter((u) => u.state === "streaming");
      const completeUpdate = updates.find((u) => u.state === "complete");

      expect(streamingUpdates.length).toBeGreaterThan(0);
      expect(completeUpdate).toBeDefined();
      expect(completeUpdate?.isPartial).toBe(false);
      expect(completeUpdate?.completionReason).toBe("complete");
      expect(completeUpdate?.data.name).toBe("John");
      expect(completeUpdate?.data.email).toBe("john@example.com");
    });

    it("should track changed paths", async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const chunks = ['{"name": "John", "age": 25}'];
      const allChangedPaths: string[] = [];

      for await (const { changedPaths } of createStableStream({
        schema,
        source: chunksToStream(chunks),
      })) {
        allChangedPaths.push(...changedPaths);
      }

      expect(allChangedPaths).toContain("name");
      expect(allChangedPaths).toContain("age");
    });
  });

  describe("Nested Objects", () => {
    it("should handle nested object streaming", async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            bio: z.string(),
          }),
        }),
      });

      const json = '{"user": {"name": "John", "profile": {"bio": "Developer"}}}';
      const chunks = [json.slice(0, 20), json.slice(20)];

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream(chunks),
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData.user.name).toBe("John");
      expect(finalData.user.profile.bio).toBe("Developer");
    });
  });

  describe("Arrays", () => {
    it("should stream array items individually", async () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const json = '{"items": ["a", "b", "c"]}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData.items).toEqual(["a", "b", "c"]);
    });

    it("should handle array of objects", async () => {
      const schema = z.object({
        rows: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
          })
        ),
      });

      const json =
        '{"rows": [{"id": 1, "name": "First"}, {"id": 2, "name": "Second"}]}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData.rows).toHaveLength(2);
      expect(finalData.rows[0]).toEqual({ id: 1, name: "First" });
      expect(finalData.rows[1]).toEqual({ id: 2, name: "Second" });
    });

    it("should trim unfilled skeleton items on complete", async () => {
      const schema = z.object({
        items: z.array(z.string()).min(5), // Pre-fill with 5 skeleton items
      });

      // Only 2 actual items in stream
      const json = '{"items": ["a", "b"]}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
        trim: true,
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      // Should be trimmed to actual count, not skeleton count
      expect(finalData.items).toEqual(["a", "b"]);
      expect(finalData.items).toHaveLength(2);
    });

    it("should trim correctly when streamed values equal skeleton defaults", async () => {
      const schema = z.object({
        items: z.array(z.number()).min(5),
      });

      const json = '{"items": [0]}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
        trim: true,
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData.items).toEqual([0]);
      expect(finalData.items).toHaveLength(1);
    });

    it("should trim to empty when stream contains an explicit empty array", async () => {
      const schema = z.object({
        items: z.array(z.string()).min(5),
      });

      const json = '{"items": []}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData.items).toEqual([]);
      expect(finalData.items).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should emit error state on source error", async () => {
      const schema = z.object({ name: z.string() });

      async function* errorSource(): AsyncGenerator<string> {
        yield '{"name": "Jo';
        throw new Error("Connection lost");
      }

      let errorUpdate: any;
      for await (const update of createStableStream({
        schema,
        source: errorSource(),
      })) {
        if (update.state === "error") {
          errorUpdate = update;
        }
      }

      expect(errorUpdate).toBeDefined();
      expect(errorUpdate.state).toBe("error");
      expect(errorUpdate.isPartial).toBe(true);
      expect(errorUpdate.completionReason).toBe("source_error");
      expect(errorUpdate.error?.message).toBe("Connection lost");
      // Data should still be available (partial)
      expect(errorUpdate.data).toHaveProperty("name");
    });

    it("should mark completion as partial when JSON is truncated", async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      });

      let finalUpdate: any;
      for await (const update of createStableStream({
        schema,
        source: chunksToStream(['{"name":"John"']),
      })) {
        if (update.state === "complete") {
          finalUpdate = update;
        }
      }

      expect(finalUpdate).toBeDefined();
      expect(finalUpdate.state).toBe("complete");
      expect(finalUpdate.isPartial).toBe(true);
      expect(finalUpdate.completionReason).toBe("incomplete_json");
      expect(finalUpdate.data.name).toBe("John");
      expect(finalUpdate.data.email).toBe("");
    });

    it("should emit error when root JSON is an array", async () => {
      const schema = z.array(z.string());

      let errorUpdate: any;
      for await (const update of createStableStream({
        schema,
        source: chunksToStream(['["a", "b"]']),
      })) {
        if (update.state === "error") {
          errorUpdate = update;
        }
      }

      expect(errorUpdate).toBeDefined();
      expect(errorUpdate.state).toBe("error");
      expect(errorUpdate.isPartial).toBe(true);
      expect(errorUpdate.completionReason).toBe("source_error");
      expect(errorUpdate.error?.message).toContain(
        "Top-level JSON must be an object"
      );
      expect(errorUpdate.error?.message).toContain(
        "Root arrays are not supported"
      );
    });
  });

  describe("Hallucination Protection", () => {
    it("should discard keys not in schema", async () => {
      const schema = z.object({
        name: z.string(),
      });

      const json = '{"name": "John", "evil": "HACKED", "password": "secret"}';

      let finalData: any;
      for await (const { data, state } of createStableStream({
        schema,
        source: chunksToStream([json]),
      })) {
        if (state === "complete") {
          finalData = data;
        }
      }

      expect(finalData).toEqual({ name: "John" });
      expect(finalData.evil).toBeUndefined();
      expect(finalData.password).toBeUndefined();
    });
  });

  describe("onUpdate Callback", () => {
    it("should call onUpdate for each emission", async () => {
      const schema = z.object({ name: z.string() });
      const onUpdate = vi.fn();

      const stream = createStableStream({
        schema,
        source: chunksToStream(['{"name": "John"}']),
        onUpdate,
      });

      // Consume the stream
      for await (const _streamItem of stream) {
        // Just iterate to consume the stream
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = _streamItem; // Mark as intentionally unused
      }

      expect(onUpdate).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ state: "complete" })
      );
    });
  });
});

describe("consumeStableStream", () => {
  it("should return final data", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const data = await consumeStableStream({
      schema,
      source: chunksToStream(['{"name": "John", "age": 25}']),
    });

    expect(data).toEqual({ name: "John", age: 25 });
  });

  it("should throw on error", async () => {
    const schema = z.object({ name: z.string() });

    // eslint-disable-next-line require-yield
    async function* errorSource(): AsyncGenerator<string> {
      throw new Error("Failed");
    }

    await expect(
      consumeStableStream({ schema, source: errorSource() })
    ).rejects.toThrow("Failed");
  });

  it("should throw when root JSON is an array", async () => {
    const schema = z.array(z.string());

    await expect(
      consumeStableStream({
        schema,
        source: chunksToStream(['["a", "b"]']),
      })
    ).rejects.toThrow("Top-level JSON must be an object");
  });

  it("should return partial data for truncated JSON without throwing", async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const data = await consumeStableStream({
      schema,
      source: chunksToStream(['{"name":"John"']),
    });

    expect(data).toEqual({ name: "John", age: 0 });
  });
});
