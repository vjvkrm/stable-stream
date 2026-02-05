# Incremental JSON Parser - Test Cases

Test cases for the schema-aware incremental JSON parser. Each test validates that the parser correctly extracts complete values while ignoring incomplete ones.

---

## Strings

- [ ] Complete string `{"name": "John"}` extracts `name: "John"`
- [ ] Incomplete string `{"name": "Jo` extracts nothing (still writing)
- [ ] Empty string `{"name": ""}` extracts `name: ""`
- [ ] String with space `{"name": "John Doe"}` extracts correctly
- [ ] Escaped quote `{"name": "John \"Doc\" Smith"}` waits for real closing quote
- [ ] Escaped backslash `{"path": "C:\\Users\\"}` handles `\\` correctly
- [ ] Newline escape `{"bio": "Line1\nLine2"}` preserves `\n`
- [ ] Tab escape `{"text": "col1\tcol2"}` preserves `\t`
- [ ] Unicode escape `{"name": "\u0041\u0042"}` becomes `"AB"`
- [ ] Incomplete unicode `{"name": "\u00` extracts nothing (still writing)
- [ ] Mixed escapes `{"s": "a\\b\"c\n"}` handles all correctly

---

## Numbers

- [ ] Complete integer `{"age": 25}` extracts `age: 25`
- [ ] Incomplete integer `{"age": 2` extracts nothing (could be 25, 200, etc.)
- [ ] Number followed by comma `{"age": 25, "x"` extracts `age: 25`
- [ ] Number followed by brace `{"age": 25}` extracts `age: 25`
- [ ] Negative number `{"temp": -10}` extracts `temp: -10`
- [ ] Decimal number `{"price": 19.99}` extracts `price: 19.99`
- [ ] Incomplete decimal `{"price": 19.` extracts nothing
- [ ] Scientific notation `{"big": 1e10}` extracts `big: 1e10`
- [ ] Negative exponent `{"small": 1e-5}` extracts correctly
- [ ] Zero `{"count": 0}` extracts `count: 0`
- [ ] Leading zero invalid `{"n": 007}` handles or rejects gracefully

---

## Booleans and Null

- [ ] Complete true `{"active": true}` extracts `active: true`
- [ ] Complete false `{"active": false}` extracts `active: false`
- [ ] Complete null `{"data": null}` extracts `data: null`
- [ ] Incomplete true `{"active": tru` extracts nothing
- [ ] Incomplete false `{"active": fal` extracts nothing
- [ ] Incomplete null `{"data": nul` extracts nothing
- [ ] True followed by comma `{"a": true, "b"` extracts `a: true`

---

## Nested Objects

- [ ] Complete nested `{"user": {"name": "John"}}` extracts full structure
- [ ] Incomplete nested `{"user": {"name": "Jo` extracts nothing for inner
- [ ] Partial nested `{"user": {"name": "John", "age": 2` extracts `user.name: "John"`
- [ ] Deeply nested `{"a": {"b": {"c": "x"}}}` extracts at all levels
- [ ] Empty nested object `{"user": {}}` extracts `user: {}`
- [ ] Incomplete empty nested `{"user": {` extracts nothing

---

## Arrays

- [ ] Complete array `{"tags": ["a", "b"]}` extracts full array
- [ ] Incomplete array `{"tags": ["a", "b` extracts `["a"]` (complete items only)
- [ ] Empty array `{"tags": []}` extracts `tags: []`
- [ ] Incomplete empty array `{"tags": [` extracts nothing
- [ ] Array of numbers `{"nums": [1, 2, 3]}` extracts correctly
- [ ] Array of objects `{"users": [{"n": "A"}, {"n": "B"}]}` extracts correctly
- [ ] Incomplete object in array `{"users": [{"n": "A"}, {"n": "B` extracts first object only
- [ ] Nested arrays `{"matrix": [[1, 2], [3, 4]]}` extracts correctly
- [ ] Mixed array `{"mix": [1, "a", true, null]}` extracts all types

---

## Whitespace Handling

- [ ] Spaces around colon `{"name" : "John"}` extracts correctly
- [ ] Newlines in JSON `{\n"name": "John"\n}` extracts correctly
- [ ] Tabs as whitespace `{\t"name":\t"John"}` extracts correctly
- [ ] No spaces `{"name":"John"}` extracts correctly
- [ ] Trailing whitespace `{"age": 25 }` extracts `age: 25`

---

## Multiple Keys

- [ ] Two complete keys `{"a": 1, "b": 2}` extracts both
- [ ] First complete second incomplete `{"a": 1, "b": 2` extracts only `a`
- [ ] Many keys extracts all complete ones
- [ ] Duplicate keys (invalid JSON) handles gracefully

---

## Edge Cases

- [ ] Empty object `{}` extracts empty object
- [ ] Incomplete opening `{` extracts nothing
- [ ] Just key no value `{"name":` extracts nothing
- [ ] Just key partial value `{"name": ` extracts nothing
- [ ] Colon in string `{"url": "http://x.com"}` doesn't confuse parser
- [ ] Brace in string `{"code": "{x}"}` doesn't confuse depth tracking
- [ ] Bracket in string `{"arr": "[1,2]"}` doesn't confuse depth tracking
- [ ] Quote in key (invalid but handle gracefully)
- [ ] Very long string (10KB+) handles without performance issues
- [ ] Very deep nesting (20+ levels) handles without stack overflow

---

## Incremental Feeding

- [ ] Single character at a time builds correct result
- [ ] Chunk boundaries mid-string handles correctly
- [ ] Chunk boundaries mid-number handles correctly
- [ ] Chunk boundaries mid-keyword handles correctly
- [ ] Reset/clear state between separate JSON objects

---

## Error Tolerance

- [ ] Missing closing brace extracts what's complete
- [ ] Missing closing bracket extracts complete array items
- [ ] Unexpected character doesn't crash, skips gracefully
- [ ] Invalid escape sequence handles or skips gracefully

---

## Summary

**Total: ~65 test cases**

### Core Principles

1. **Extract complete values only** - Never emit a value that might change
2. **Track string escaping** - `\"` is not end of string
3. **Track nesting depth** - `{` and `[` inside strings don't count
4. **Numbers need delimiters** - `25` is complete only when followed by `,` `}` `]` or whitespace
5. **Keywords must be full** - `tru` is not `true`
6. **Be tolerant** - Don't crash on invalid input, extract what you can
