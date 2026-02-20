import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { z } from 'zod';
import { useStableStream } from './useStableStream';

// Helper to create async iterable from chunks
async function* chunksToStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('useStableStream', () => {
  it('should return hydrated skeleton when source is null', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const { result } = renderHook(() =>
      useStableStream({ schema, source: null })
    );

    expect(result.current.data).toEqual({ name: '', age: 0 });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isPartial).toBe(false);
    expect(result.current.completionReason).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should pre-fill arrays with .min()', () => {
    const schema = z.object({
      items: z.array(z.object({
        id: z.number(),
        name: z.string(),
      })).min(3),
    });

    const { result } = renderHook(() =>
      useStableStream({ schema, source: null })
    );

    expect(result.current.data.items).toHaveLength(3);
    expect(result.current.data.items[0]).toEqual({ id: 0, name: '' });
  });

  it('should trim skeleton arrays when trim config is passed as true', async () => {
    const schema = z.object({
      items: z.array(z.string()).min(3)
    });

    const source = chunksToStream(['{"items": ["John"]}']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: false, trim: true })
    );

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.data.items).toHaveLength(1);
    expect(result.current.data.items[0]).toBe('John');
  });

  it('should stream and update data', async () => {
    const schema = z.object({
      name: z.string(),
    });

    const source = chunksToStream(['{"name": "John"}']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: false })
    );

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.data.name).toBe('John');
    expect(result.current.isPartial).toBe(false);
    expect(result.current.completionReason).toBe('complete');
  });

  it('should mark completion as partial for truncated JSON', async () => {
    const schema = z.object({
      name: z.string(),
      email: z.string(),
    });

    const source = chunksToStream(['{"name":"John"']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: false })
    );

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.error).toBe(null);
    expect(result.current.isPartial).toBe(true);
    expect(result.current.completionReason).toBe('incomplete_json');
    expect(result.current.data).toEqual({ name: 'John', email: '' });
  });

  it('should expose source errors as partial', async () => {
    const schema = z.object({
      name: z.string(),
    });

    async function* failingStream(): AsyncGenerator<string> {
      yield '{"name":"Jo';
      throw new Error('Connection lost');
    }

    const source = failingStream();

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: false })
    );

    for (let i = 0; i < 20 && !result.current.error; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(result.current.error?.message).toBe('Connection lost');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isPartial).toBe(true);
    expect(result.current.completionReason).toBe('source_error');
  });

  it('should complete successfully with throttling enabled', async () => {
    const schema = z.object({
      name: z.string(),
    });

    const source = chunksToStream(['{"name":"John"}']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: true })
    );

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isPartial).toBe(false);
    expect(result.current.completionReason).toBe('complete');
    expect(result.current.data.name).toBe('John');
  });

  it('reset should clear completion diagnostics', async () => {
    const schema = z.object({
      name: z.string(),
      email: z.string(),
    });

    const source = chunksToStream(['{"name":"John"']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: false })
    );

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.isPartial).toBe(true);
    expect(result.current.completionReason).toBe('incomplete_json');

    act(() => {
      result.current.reset();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.isPartial).toBe(false);
    expect(result.current.completionReason).toBe(null);
    expect(result.current.data).toEqual({ name: '', email: '' });
  });

  it('should support static string fallback out of the box', async () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const staticJson = '{"name": "Alice", "age": 30}';

    const { result } = renderHook(() =>
      useStableStream({ schema, source: staticJson, throttle: false })
    );

    // Provide some time for internal async iterator to chunk the string
    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.data).toEqual({ name: 'Alice', age: 30 });
  });

  it('should support time-based throttling', async () => {
    const schema = z.object({
      name: z.string(),
    });

    const source = chunksToStream(['{"name":', '"Bob"}']);

    const { result } = renderHook(() =>
      useStableStream({ schema, source, throttle: 10 })
    );

    // Initial state
    expect(result.current.data.name).toBe('');

    // Await condition polling loop that avoids RTL internal macro starving
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100)); // Advance real event loop
        if (result.current.isComplete) break;
    }

    expect(result.current.isComplete).toBe(true);
    expect(result.current.data.name).toBe('Bob');
  });
});
