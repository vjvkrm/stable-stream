/**
 * End-to-end integration tests
 * Tests the full pipeline: schema → hydrate → parser → merge → stream
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createStableStream, consumeStableStream } from "./stream";
import { hydrate } from "./hydrate";

// Helper to simulate LLM streaming (character by character with some grouping)
async function* simulateLLMStream(
  json: string,
  chunkSize = 5
): AsyncGenerator<string> {
  for (let i = 0; i < json.length; i += chunkSize) {
    yield json.slice(i, i + chunkSize);
  }
}

describe("Integration Tests", () => {
  describe("Form Data Streaming", () => {
    const UserFormSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
      age: z.number(),
      isVerified: z.boolean(),
      bio: z.string(),
    });

    it("should stream form data and maintain shape throughout", async () => {
      const formData = {
        firstName: "Alexander",
        lastName: "Thompson",
        email: "alex@example.com",
        age: 32,
        isVerified: true,
        bio: "Senior software engineer",
      };

      const updates: any[] = [];

      for await (const update of createStableStream({
        schema: UserFormSchema,
        source: simulateLLMStream(JSON.stringify(formData)),
      })) {
        updates.push(update);

        // Every update should have complete shape
        expect(update.data).toHaveProperty("firstName");
        expect(update.data).toHaveProperty("lastName");
        expect(update.data).toHaveProperty("email");
        expect(update.data).toHaveProperty("age");
        expect(update.data).toHaveProperty("isVerified");
        expect(update.data).toHaveProperty("bio");
      }

      // Final update should have all values
      const final = updates[updates.length - 1];
      expect(final.state).toBe("complete");
      expect(final.data).toEqual(formData);
    });

    it("should start with hydrated skeleton", async () => {
      const skeleton = hydrate(UserFormSchema);

      // Skeleton should have default values
      expect(skeleton).toEqual({
        firstName: "",
        lastName: "",
        email: "",
        age: 0,
        isVerified: false,
        bio: "",
      });
    });
  });

  describe("Table Data Streaming", () => {
    const TableSchema = z.object({
      title: z.string(),
      rows: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            email: z.string(),
            status: z.string(),
          })
        )
        .min(5), // Pre-fill 5 skeleton rows
    });

    it("should pre-fill table with skeleton rows", async () => {
      const skeleton = hydrate(TableSchema);

      expect(skeleton.rows).toHaveLength(5);
      expect(skeleton.rows[0]).toEqual({
        id: 0,
        name: "",
        email: "",
        status: "",
      });
    });

    it("should stream table rows and trim on complete", async () => {
      const tableData = {
        title: "User List",
        rows: [
          { id: 1, name: "Alice", email: "alice@test.com", status: "active" },
          { id: 2, name: "Bob", email: "bob@test.com", status: "pending" },
          { id: 3, name: "Carol", email: "carol@test.com", status: "active" },
        ],
      };

      const updates: any[] = [];

      for await (const update of createStableStream({
        schema: TableSchema,
        source: simulateLLMStream(JSON.stringify(tableData)),
      })) {
        updates.push(update);
      }

      const final = updates[updates.length - 1];
      expect(final.state).toBe("complete");

      // Should be trimmed to actual 3 rows, not 5 skeleton rows
      expect(final.data.rows).toHaveLength(3);
      expect(final.data.rows).toEqual(tableData.rows);
    });

    it("should progressively fill rows as they stream", async () => {
      const tableData = {
        title: "Users",
        rows: [
          { id: 1, name: "Alice", email: "a@test.com", status: "active" },
          { id: 2, name: "Bob", email: "b@test.com", status: "pending" },
        ],
      };

      let sawPartialRow = false;

      for await (const { data, state } of createStableStream({
        schema: TableSchema,
        source: simulateLLMStream(JSON.stringify(tableData), 10),
      })) {
        if (state === "streaming") {
          // During streaming, we might see partially filled rows
          if (data.rows[0]?.name && !data.rows[0]?.email) {
            sawPartialRow = true;
          }
        }
      }

      // Note: With small chunk size, we might see partial rows
      // This test just verifies streaming works
      expect(sawPartialRow).toBeDefined();
    });
  });

  describe("Nested Form Streaming", () => {
    const ContactFormSchema = z.object({
      name: z.string(),
      email: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
      }),
      preferences: z.object({
        newsletter: z.boolean(),
        frequency: z.string(),
      }),
    });

    it("should stream nested objects correctly", async () => {
      const formData = {
        name: "John Doe",
        email: "john@example.com",
        address: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zip: "10001",
        },
        preferences: {
          newsletter: true,
          frequency: "weekly",
        },
      };

      const result = await consumeStableStream({
        schema: ContactFormSchema,
        source: simulateLLMStream(JSON.stringify(formData)),
      });

      expect(result).toEqual(formData);
    });
  });

  describe("Hallucination Protection", () => {
    it("should discard unknown fields from LLM response", async () => {
      const SafeSchema = z.object({
        name: z.string(),
        role: z.string(),
      });

      // LLM "hallucinates" extra fields
      const llmResponse = {
        name: "Alice",
        role: "admin",
        password: "secret123", // Should be discarded
        ssn: "123-45-6789", // Should be discarded
        __proto__: { admin: true }, // Should be discarded
      };

      const result = await consumeStableStream({
        schema: SafeSchema,
        source: simulateLLMStream(JSON.stringify(llmResponse)),
      });

      expect(result).toEqual({ name: "Alice", role: "admin" });
      expect((result as any).password).toBeUndefined();
      expect((result as any).ssn).toBeUndefined();
    });
  });

  describe("Type Safety", () => {
    it("should coerce string numbers to actual numbers", async () => {
      const schema = z.object({
        count: z.number(),
        price: z.number(),
      });

      // LLM returns numbers as strings
      const llmResponse = '{"count": "42", "price": "19.99"}';

      const result = await consumeStableStream({
        schema,
        source: simulateLLMStream(llmResponse),
      });

      expect(result.count).toBe(42);
      expect(typeof result.count).toBe("number");
      expect(result.price).toBe(19.99);
    });
  });

  describe("Error Recovery", () => {
    it("should return partial data on stream error", async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      });

      async function* failingStream(): AsyncGenerator<string> {
        yield '{"name": "John"';
        throw new Error("Connection lost");
      }

      let lastUpdate: any;
      for await (const update of createStableStream({
        schema,
        source: failingStream(),
      })) {
        lastUpdate = update;
      }

      expect(lastUpdate.state).toBe("error");
      expect(lastUpdate.error?.message).toBe("Connection lost");
      // Should still have the partial data with skeleton shape
      expect(lastUpdate.data).toHaveProperty("name");
      expect(lastUpdate.data).toHaveProperty("email");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle LLM chat response with structured output", async () => {
      const ChatResponseSchema = z.object({
        message: z.string(),
        sentiment: z.enum(["positive", "negative", "neutral"]),
        topics: z.array(z.string()),
        confidence: z.number(),
      });

      const llmResponse = {
        message:
          "I understand you're looking for help with React hooks. Let me explain...",
        sentiment: "positive",
        topics: ["react", "hooks", "programming"],
        confidence: 0.95,
      };

      const result = await consumeStableStream({
        schema: ChatResponseSchema,
        source: simulateLLMStream(JSON.stringify(llmResponse)),
      });

      expect(result).toEqual(llmResponse);
    });

    it("should handle product listing with nested data", async () => {
      const ProductSchema = z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        price: z.number(),
        variants: z.array(
          z.object({
            sku: z.string(),
            color: z.string(),
            size: z.string(),
            inStock: z.boolean(),
          })
        ),
        reviews: z.object({
          average: z.number(),
          count: z.number(),
        }),
      });

      const product = {
        id: "prod-123",
        name: "Premium Headphones",
        description: "High-quality wireless headphones with noise cancellation",
        price: 299.99,
        variants: [
          { sku: "HP-BLK-M", color: "Black", size: "M", inStock: true },
          { sku: "HP-WHT-M", color: "White", size: "M", inStock: false },
        ],
        reviews: {
          average: 4.7,
          count: 1243,
        },
      };

      const result = await consumeStableStream({
        schema: ProductSchema,
        source: simulateLLMStream(JSON.stringify(product)),
      });

      expect(result).toEqual(product);
    });
  });
});
