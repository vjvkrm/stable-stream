import { describe, it, expect } from 'vitest';
import { createIncrementalParser } from './index';

describe('IncrementalParser', () => {
  describe('Strings', () => {
    it('extracts complete string', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "John"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John', path: 'name' });
    });

    it('extracts nothing for incomplete string', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "Jo');
      expect(results).toHaveLength(0);
    });

    it('extracts empty string', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": ""}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: '', path: 'name' });
    });

    it('extracts string with spaces', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "John Doe"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John Doe', path: 'name' });
    });

    it('handles escaped quote', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "John \\"Doc\\" Smith"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John "Doc" Smith', path: 'name' });
    });

    it('handles escaped backslash', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"path": "C:\\\\Users\\\\"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'path', value: 'C:\\Users\\', path: 'path' });
    });

    it('handles newline escape', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"bio": "Line1\\nLine2"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'bio', value: 'Line1\nLine2', path: 'bio' });
    });

    it('handles tab escape', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"text": "col1\\tcol2"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'text', value: 'col1\tcol2', path: 'text' });
    });

    it('handles unicode escape', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "\\u0041\\u0042"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'AB', path: 'name' });
    });

    it('extracts nothing for incomplete unicode', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "\\u00');
      expect(results).toHaveLength(0);
    });
  });

  describe('Numbers', () => {
    it('extracts complete integer', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"age": 25}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'age', value: 25, path: 'age' });
    });

    it('extracts nothing for incomplete integer', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"age": 2');
      expect(results).toHaveLength(0);
    });

    it('extracts number followed by comma', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"age": 25, "name"');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'age', value: 25, path: 'age' });
    });

    it('extracts negative number', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"temp": -10}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'temp', value: -10, path: 'temp' });
    });

    it('extracts decimal number', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"price": 19.99}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'price', value: 19.99, path: 'price' });
    });

    it('extracts zero', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"count": 0}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'count', value: 0, path: 'count' });
    });

    it('extracts scientific notation', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"big": 1e10}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'big', value: 1e10, path: 'big' });
    });
  });

  describe('Booleans and Null', () => {
    it('extracts true', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"active": true}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'active', value: true, path: 'active' });
    });

    it('extracts false', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"active": false}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'active', value: false, path: 'active' });
    });

    it('extracts null', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"data": null}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'data', value: null, path: 'data' });
    });

    it('extracts nothing for incomplete true', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"active": tru');
      expect(results).toHaveLength(0);
    });

    it('extracts nothing for incomplete false', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"active": fal');
      expect(results).toHaveLength(0);
    });

    it('extracts nothing for incomplete null', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"data": nul');
      expect(results).toHaveLength(0);
    });

    it('extracts true followed by comma', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": true, "b"');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'a', value: true, path: 'a' });
    });
  });

  describe('Multiple Keys', () => {
    it('extracts two complete keys', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": 1, "b": 2}');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ key: 'a', value: 1, path: 'a' });
      expect(results[1]).toEqual({ key: 'b', value: 2, path: 'b' });
    });

    it('extracts first complete, ignores second incomplete', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": 1, "b": 2');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'a', value: 1, path: 'a' });
    });

    it('extracts many keys', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": 1, "b": "two", "c": true, "d": null}');
      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({ key: 'a', value: 1, path: 'a' });
      expect(results[1]).toEqual({ key: 'b', value: 'two', path: 'b' });
      expect(results[2]).toEqual({ key: 'c', value: true, path: 'c' });
      expect(results[3]).toEqual({ key: 'd', value: null, path: 'd' });
    });
  });

  describe('Incremental Feeding', () => {
    it('builds result across multiple chunks', () => {
      const parser = createIncrementalParser();

      let results = parser.process('{"name": "Jo');
      expect(results).toHaveLength(0);

      results = parser.process('hn", "age": 25}');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ key: 'name', value: 'John', path: 'name' });
      expect(results[1]).toEqual({ key: 'age', value: 25, path: 'age' });
    });

    it('handles chunk boundary mid-string', () => {
      const parser = createIncrementalParser();

      let results = parser.process('{"name": "John');
      expect(results).toHaveLength(0);

      results = parser.process(' Doe"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John Doe', path: 'name' });
    });

    it('handles chunk boundary mid-number', () => {
      const parser = createIncrementalParser();

      let results = parser.process('{"age": 2');
      expect(results).toHaveLength(0);

      results = parser.process('5}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'age', value: 25, path: 'age' });
    });

    it('handles chunk boundary mid-keyword', () => {
      const parser = createIncrementalParser();

      let results = parser.process('{"active": tru');
      expect(results).toHaveLength(0);

      results = parser.process('e}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'active', value: true, path: 'active' });
    });

    it('handles single character at a time', () => {
      const parser = createIncrementalParser();
      const json = '{"a": 1}';
      let results: ReturnType<typeof parser.process> = [];

      for (const char of json) {
        results = parser.process(char);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'a', value: 1, path: 'a' });
    });
  });

  describe('Whitespace Handling', () => {
    it('handles spaces around colon', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name" : "John"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John', path: 'name' });
    });

    it('handles newlines in JSON', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{\n"name": "John"\n}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John', path: 'name' });
    });

    it('handles no spaces', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name":"John"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'John', path: 'name' });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty object', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{}');
      expect(results).toHaveLength(0);
    });

    it('handles colon in string value', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"url": "http://example.com"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'url', value: 'http://example.com', path: 'url' });
    });

    it('handles brace in string value', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"code": "{x}"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'code', value: '{x}', path: 'code' });
    });

    it('handles bracket in string value', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"arr": "[1,2]"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'arr', value: '[1,2]', path: 'arr' });
    });

    it('handles comma in string value', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"name": "Doe, John"}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'name', value: 'Doe, John', path: 'name' });
    });
  });

  describe('Arrays (Streaming)', () => {
    it('streams array items individually', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"tags": ["a", "b"]}');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ key: 'tags', value: 'a', path: 'tags[0]' });
      expect(results[1]).toEqual({ key: 'tags', value: 'b', path: 'tags[1]' });
    });

    it('empty array emits a complete array value', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"tags": []}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'tags', value: [], path: 'tags' });
    });

    it('emits complete items, holds incomplete', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"tags": ["a", "b');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'tags', value: 'a', path: 'tags[0]' });
    });

    it('streams array of numbers individually', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"nums": [1, 2, 3]}');
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ key: 'nums', value: 1, path: 'nums[0]' });
      expect(results[1]).toEqual({ key: 'nums', value: 2, path: 'nums[1]' });
      expect(results[2]).toEqual({ key: 'nums', value: 3, path: 'nums[2]' });
    });

    it('streams array of objects individually', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"users": [{"name": "A"}, {"name": "B"}]}');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ key: 'users', value: { name: 'A' }, path: 'users[0]' });
      expect(results[1]).toEqual({ key: 'users', value: { name: 'B' }, path: 'users[1]' });
    });

    it('emits complete objects, holds incomplete in array', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"users": [{"name": "A"}, {"name": "B');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'users', value: { name: 'A' }, path: 'users[0]' });
    });

    it('streams mixed type array', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"mix": [1, "a", true, null]}');
      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({ key: 'mix', value: 1, path: 'mix[0]' });
      expect(results[1]).toEqual({ key: 'mix', value: 'a', path: 'mix[1]' });
      expect(results[2]).toEqual({ key: 'mix', value: true, path: 'mix[2]' });
      expect(results[3]).toEqual({ key: 'mix', value: null, path: 'mix[3]' });
    });
  });

  describe('Nested Objects', () => {
    it('extracts complete nested object', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"user": {"name": "John"}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'user', value: { name: 'John' }, path: 'user' });
    });

    it('extracts empty nested object', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"user": {}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'user', value: {}, path: 'user' });
    });

    it('extracts nothing for incomplete nested object', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"user": {"name": "Jo');
      expect(results).toHaveLength(0);
    });

    it('extracts deeply nested object (3 levels)', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": {"b": {"c": "x"}}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'a', value: { b: { c: 'x' } }, path: 'a' });
    });

    it('extracts deeply nested object (5 levels)', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"l1": {"l2": {"l3": {"l4": {"l5": "deep"}}}}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: 'l1',
        value: { l2: { l3: { l4: { l5: 'deep' } } } },
        path: 'l1',
      });
    });

    it('extracts deeply nested with mixed types', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"user": {"profile": {"age": 25, "active": true, "name": "John"}}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: 'user',
        value: { profile: { age: 25, active: true, name: 'John' } },
        path: 'user',
      });
    });

    it('extracts nested object with array inside', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"user": {"tags": ["a", "b"], "name": "John"}}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: 'user',
        value: { tags: ['a', 'b'], name: 'John' },
        path: 'user',
      });
    });

    it('extracts nothing for incomplete deeply nested', () => {
      const parser = createIncrementalParser();
      const results = parser.process('{"a": {"b": {"c": "x"');
      expect(results).toHaveLength(0);
    });
  });

  describe('Reset', () => {
    it('resets parser state', () => {
      const parser = createIncrementalParser();

      parser.process('{"name": "Jo');
      parser.reset();

      const results = parser.process('{"age": 25}');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ key: 'age', value: 25, path: 'age' });
    });
  });
});
