import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
  });
});
