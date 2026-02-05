# @stable-stream/react

React hook for streaming structured JSON from LLMs. Zero layout shift, always type-safe.

## Installation

```bash
npm install @stable-stream/react @stable-stream/core zod
```

## The Problem

Without stable-stream, streaming JSON from LLMs is painful:

```tsx
// ❌ WITHOUT stable-stream
function UserProfile({ textStream }) {
  const [data, setData] = useState(null);
  const [buffer, setBuffer] = useState('');

  useEffect(() => {
    // Manual JSON parsing...
    // Handle incomplete JSON...
    // Hope the LLM doesn't hallucinate fields...
    // UI jumps as fields appear...
  }, [textStream]);

  return (
    <div>
      {/* Crashes if data is null */}
      {/* Layout shifts as fields appear */}
      {/* TypeScript unhappy */}
      <h1>{data?.name}</h1>
    </div>
  );
}
```

## The Solution

```tsx
// ✅ WITH stable-stream
import { useStableStream } from '@stable-stream/react';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
  bio: z.string(),
});

function UserProfile({ textStream }) {
  const { data, isStreaming } = useStableStream({
    schema: UserSchema,
    source: textStream,
  });

  return (
    <div>
      <h1>{data.name || 'Loading...'}</h1>
      <p>{data.email}</p>
      <p>{data.bio}</p>
      {isStreaming && <Spinner />}
    </div>
  );
}
```

**That's it.** `data` always has the complete shape. No null checks. No layout shift. Type-safe.

## Real-World Example

```tsx
import { useState } from 'react';
import { useStableStream } from '@stable-stream/react';
import { z } from 'zod';

// Define your schema once
const ProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number(),
  features: z.array(z.string()).min(3), // Pre-fills 3 skeleton items
});

function ProductGenerator() {
  const [stream, setStream] = useState(null);

  const { data, isStreaming, isComplete, error, reset } = useStableStream({
    schema: ProductSchema,
    source: stream,
  });

  const generate = async () => {
    reset();
    const response = await fetch('/api/generate-product', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'A futuristic gadget' }),
    });
    // Convert response to text stream
    setStream(response.body.pipeThrough(new TextDecoderStream()));
  };

  return (
    <div>
      <button onClick={generate} disabled={isStreaming}>
        {isStreaming ? 'Generating...' : 'Generate Product'}
      </button>

      {error && <p className="error">{error.message}</p>}

      <div className="product-card">
        <h2>{data.name || '...'}</h2>
        <p className="price">${data.price || 0}</p>
        <p>{data.description || '...'}</p>

        <h3>Features</h3>
        <ul>
          {data.features.map((feature, i) => (
            <li key={i}>{feature || '...'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

## API

```typescript
const { data, isStreaming, isComplete, error, reset } = useStableStream({
  schema,        // Zod schema (required)
  source,        // AsyncIterable<string> | null
  throttle,      // Limit to 60fps (default: true)
  onComplete,    // Callback when done
  onError,       // Callback on error
});
```

| Return | Type | Description |
|--------|------|-------------|
| `data` | `z.infer<Schema>` | Always complete shape, fills as stream progresses |
| `isStreaming` | `boolean` | True while receiving data |
| `isComplete` | `boolean` | True when finished successfully |
| `error` | `Error \| null` | Error if stream failed |
| `reset` | `() => void` | Reset to initial skeleton |

## Table Example with Skeleton Rows

```tsx
const TableSchema = z.object({
  rows: z.array(z.object({
    id: z.number(),
    name: z.string(),
    status: z.string(),
  })).min(5), // Shows 5 skeleton rows while loading
});

function DataTable({ textStream }) {
  const { data, isStreaming } = useStableStream({
    schema: TableSchema,
    source: textStream,
  });

  return (
    <table>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i} className={row.name ? '' : 'skeleton'}>
            <td>{row.id || '—'}</td>
            <td>{row.name || '...'}</td>
            <td>{row.status || '...'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Performance

- **1 re-render per update** (batched state)
- **60fps max** with RAF throttling
- **Structural sharing** - unchanged data keeps same reference
- **Cleanup on unmount** - no memory leaks

## Compatibility

| React | Status |
|-------|--------|
| 19 | ✅ |
| 18 | ✅ |
| 17 | ⚠️ Works (no auto-batching) |

## Tips

```tsx
// ✅ Define schema outside component
const MySchema = z.object({ name: z.string() });

function MyComponent() {
  useStableStream({ schema: MySchema, source });
}

// ❌ Don't create schema inside component
function MyComponent() {
  useStableStream({ schema: z.object({ name: z.string() }), source }); // Bad!
}
```

## License

MIT
