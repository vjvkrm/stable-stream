/**
 * Incremental JSON Parser
 *
 * Extracts complete key-value pairs from streaming JSON chunks.
 * Does not fix or auto-complete JSON - only emits values when fully complete.
 *
 * @example
 * const parser = createIncrementalParser();
 * parser.process('{"name": "Jo');     // []
 * parser.process('hn", "age": 25}');  // [{key: "name", value: "John"}, {key: "age", value: 25}]
 */

export interface ParsedValue {
  key: string;
  value: unknown;
  path: string; // Dot notation path for nested values, e.g., "user.name"
}

export interface ParserState {
  inString: boolean;
  escaped: boolean;
  depth: number;
  buffer: string;
  keyBuffer: string;
  currentKey: string;
  currentPath: string[];
  expectingKey: boolean;
  expectingValue: boolean;
  valueStarted: boolean;
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'unknown';
  nestedDepth: number; // Track depth within a nested value (object or array)
  // Array streaming support
  inArrayValue: boolean; // Are we inside an array value?
  arrayIndex: number; // Current index in the array
  arrayItemBuffer: string; // Buffer for current array item
  arrayItemDepth: number; // Depth within current array item
  arrayItemType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'unknown';
}

export interface IncrementalParser {
  process(chunk: string): ParsedValue[];
  getState(): ParserState;
  reset(): void;
}

function createInitialState(): ParserState {
  return {
    inString: false,
    escaped: false,
    depth: 0,
    buffer: '',
    keyBuffer: '',
    currentKey: '',
    currentPath: [],
    expectingKey: true,
    expectingValue: false,
    valueStarted: false,
    valueType: 'unknown',
    nestedDepth: 0,
    // Array streaming
    inArrayValue: false,
    arrayIndex: 0,
    arrayItemBuffer: '',
    arrayItemDepth: 0,
    arrayItemType: 'unknown',
  };
}

/**
 * Parse a completed value buffer into its JavaScript equivalent
 */
function parseValue(buffer: string, type: ParserState['valueType']): unknown {
  const trimmed = buffer.trim();

  if (type === 'string') {
    // Remove surrounding quotes and handle escape sequences
    const inner = trimmed.slice(1, -1);
    return unescapeString(inner);
  }

  if (type === 'number') {
    const num = Number(trimmed);
    return isNaN(num) ? 0 : num;
  }

  if (type === 'boolean') {
    return trimmed === 'true';
  }

  if (type === 'null') {
    return null;
  }

  if (type === 'object' || type === 'array') {
    // For nested objects/arrays, try to parse
    try {
      return JSON.parse(trimmed);
    } catch {
      return type === 'object' ? {} : [];
    }
  }

  // Unknown type - try to infer
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return unescapeString(trimmed.slice(1, -1));
  }
  const num = Number(trimmed);
  if (!isNaN(num)) return num;

  return trimmed;
}

/**
 * Unescape JSON string escape sequences
 */
function unescapeString(str: string): string {
  let result = '';
  let i = 0;

  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1];
      switch (next) {
        case '"':
          result += '"';
          i += 2;
          break;
        case '\\':
          result += '\\';
          i += 2;
          break;
        case '/':
          result += '/';
          i += 2;
          break;
        case 'b':
          result += '\b';
          i += 2;
          break;
        case 'f':
          result += '\f';
          i += 2;
          break;
        case 'n':
          result += '\n';
          i += 2;
          break;
        case 'r':
          result += '\r';
          i += 2;
          break;
        case 't':
          result += '\t';
          i += 2;
          break;
        case 'u':
          // Unicode escape: \uXXXX
          if (i + 5 < str.length) {
            const hex = str.slice(i + 2, i + 6);
            const codePoint = parseInt(hex, 16);
            if (!isNaN(codePoint)) {
              result += String.fromCharCode(codePoint);
              i += 6;
              break;
            }
          }
          // Invalid unicode escape, keep as-is
          result += str[i];
          i++;
          break;
        default:
          // Unknown escape, keep the backslash
          result += str[i];
          i++;
      }
    } else {
      result += str[i];
      i++;
    }
  }

  return result;
}

/**
 * Check if a character is whitespace
 */
function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

/**
 * Create an incremental JSON parser
 */
export function createIncrementalParser(): IncrementalParser {
  let state = createInitialState();

  function process(chunk: string): ParsedValue[] {
    const results: ParsedValue[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];

      // Handle escape sequences
      if (state.escaped) {
        if (state.inArrayValue) {
          state.arrayItemBuffer += char;
        } else if (state.valueType === 'object') {
          state.buffer += char;
        } else if (state.expectingKey) {
          state.keyBuffer += char;
        } else {
          state.buffer += char;
        }
        state.escaped = false;
        continue;
      }

      // Handle backslash (escape next char) - only inside strings
      if (char === '\\' && state.inString) {
        state.escaped = true;
        if (state.inArrayValue) {
          state.arrayItemBuffer += char;
        } else if (state.valueType === 'object') {
          state.buffer += char;
        } else if (state.expectingKey) {
          state.keyBuffer += char;
        } else {
          state.buffer += char;
        }
        continue;
      }

      // ========== ARRAY ITEM STREAMING ==========
      if (state.inArrayValue) {
        // Handle string boundaries inside array
        if (char === '"' && !state.escaped) {
          state.inString = !state.inString;
        }

        // Track depth for nested structures inside array items
        if (!state.inString) {
          if (char === '{' || char === '[') {
            state.arrayItemDepth++;
            state.arrayItemBuffer += char;
            if (state.arrayItemDepth === 1 && char === '{') {
              state.arrayItemType = 'object';
            } else if (state.arrayItemDepth === 1 && char === '[') {
              state.arrayItemType = 'array';
            }
            continue;
          }

          if (char === '}' || char === ']') {
            if (state.arrayItemDepth > 0) {
              state.arrayItemDepth--;
              state.arrayItemBuffer += char;

              // Array item complete (object or nested array closed)
              if (state.arrayItemDepth === 0 && state.arrayItemBuffer.length > 0) {
                const path = `${state.currentKey}[${state.arrayIndex}]`;
                results.push({
                  key: state.currentKey,
                  value: parseValue(state.arrayItemBuffer, state.arrayItemType),
                  path,
                });
                state.arrayIndex++;
                state.arrayItemBuffer = '';
                state.arrayItemType = 'unknown';
              }
              continue;
            }

            // This ] closes the array itself
            if (char === ']') {
              // Emit any pending primitive value in buffer
              if (state.arrayItemBuffer.trim().length > 0 && state.arrayItemDepth === 0) {
                const path = `${state.currentKey}[${state.arrayIndex}]`;
                results.push({
                  key: state.currentKey,
                  value: parseValue(state.arrayItemBuffer.trim(), state.arrayItemType),
                  path,
                });
              } else if (state.arrayIndex === 0) {
                // Empty array should still emit once so downstream can trim skeleton rows.
                const path = [...state.currentPath, state.currentKey].join('.');
                results.push({
                  key: state.currentKey,
                  value: [],
                  path,
                });
              }

              // Exit array mode
              state.inArrayValue = false;
              state.valueStarted = false;
              state.expectingValue = false;
              state.valueType = 'unknown';
              state.arrayIndex = 0;
              state.arrayItemBuffer = '';
              state.arrayItemDepth = 0;
              state.arrayItemType = 'unknown';
              continue;
            }
          }

          // Comma separates array items
          if (char === ',' && state.arrayItemDepth === 0) {
            // Emit the completed item
            if (state.arrayItemBuffer.trim().length > 0) {
              const path = `${state.currentKey}[${state.arrayIndex}]`;
              results.push({
                key: state.currentKey,
                value: parseValue(state.arrayItemBuffer.trim(), state.arrayItemType),
                path,
              });
              state.arrayIndex++;
              state.arrayItemBuffer = '';
              state.arrayItemType = 'unknown';
            }
            continue;
          }

          // Whitespace at depth 0 - skip
          if (isWhitespace(char) && state.arrayItemDepth === 0 && state.arrayItemBuffer.trim().length === 0) {
            continue;
          }

          // Detect primitive types at start of array item
          if (state.arrayItemDepth === 0 && state.arrayItemBuffer.trim().length === 0) {
            if (char === 't' || char === 'f') {
              state.arrayItemType = 'boolean';
            } else if (char === 'n') {
              state.arrayItemType = 'null';
            } else if (char === '-' || (char >= '0' && char <= '9')) {
              state.arrayItemType = 'number';
            } else if (char === '"') {
              state.arrayItemType = 'string';
            }
          }
        }

        // Accumulate character into array item buffer
        state.arrayItemBuffer += char;
        continue;
      }

      // ========== NESTED OBJECT HANDLING ==========
      if (state.nestedDepth > 0) {
        state.buffer += char;

        if (char === '"' && !state.escaped) {
          state.inString = !state.inString;
        }

        if (!state.inString) {
          if (char === '{' || char === '[') {
            state.nestedDepth++;
          } else if (char === '}' || char === ']') {
            state.nestedDepth--;
            if (state.nestedDepth === 0) {
              // Nested value complete
              const path = [...state.currentPath, state.currentKey].join('.');
              results.push({
                key: state.currentKey,
                value: parseValue(state.buffer, state.valueType),
                path,
              });
              state.buffer = '';
              state.valueStarted = false;
              state.expectingValue = false;
              state.valueType = 'unknown';
              state.inString = false;
            }
          }
        }
        continue;
      }

      // ========== NORMAL PARSING ==========

      // Handle quote character
      if (char === '"') {
        if (!state.inString) {
          // Starting a string
          state.inString = true;
          if (state.expectingKey) {
            state.keyBuffer = '';
          } else if (state.expectingValue) {
            state.valueStarted = true;
            state.valueType = 'string';
            state.buffer = '"';
          }
        } else {
          // Ending a string
          state.inString = false;
          if (state.expectingKey) {
            // Key complete
            state.currentKey = state.keyBuffer;
            state.expectingKey = false;
          } else if (state.expectingValue && state.valueType === 'string') {
            // String value complete
            state.buffer += '"';
            const path = [...state.currentPath, state.currentKey].join('.');
            results.push({
              key: state.currentKey,
              value: parseValue(state.buffer, 'string'),
              path,
            });
            state.buffer = '';
            state.valueStarted = false;
            state.expectingValue = false;
            state.valueType = 'unknown';
          }
        }
        continue;
      }

      // Inside a string - accumulate characters
      if (state.inString) {
        if (state.expectingKey) {
          state.keyBuffer += char;
        } else {
          state.buffer += char;
        }
        continue;
      }

      // Outside string - handle structural characters
      if (isWhitespace(char)) {
        // Whitespace can terminate numbers/booleans/null
        if (state.valueStarted && state.buffer.length > 0) {
          if (state.valueType === 'number' || state.valueType === 'boolean' || state.valueType === 'null') {
            // Check if value is complete
            const trimmed = state.buffer.trim();
            if (isCompleteValue(trimmed, state.valueType)) {
              const path = [...state.currentPath, state.currentKey].join('.');
              results.push({
                key: state.currentKey,
                value: parseValue(state.buffer, state.valueType),
                path,
              });
              state.buffer = '';
              state.valueStarted = false;
              state.expectingValue = false;
              state.valueType = 'unknown';
            }
          }
        }
        continue;
      }

      if (char === '{') {
        state.depth++;
        if (state.depth === 1) {
          // Root object started
          state.expectingKey = true;
          state.expectingValue = false;
        } else if (state.expectingValue) {
          // Nested object started
          state.valueStarted = true;
          state.valueType = 'object';
          state.nestedDepth = 1;
          state.buffer = char;
        }
        continue;
      }

      if (char === '}') {
        // Check if we have a pending primitive value to emit
        if (state.valueStarted && state.buffer.length > 0 && state.depth === 1) {
          if (state.valueType !== 'object' && state.valueType !== 'array') {
            const path = [...state.currentPath, state.currentKey].join('.');
            results.push({
              key: state.currentKey,
              value: parseValue(state.buffer, state.valueType),
              path,
            });
            state.buffer = '';
            state.valueStarted = false;
            state.expectingValue = false;
            state.valueType = 'unknown';
          }
        }

        state.depth--;
        if (state.depth === 0) {
          // Root object ended
          state.expectingKey = false;
        }
        continue;
      }

      if (char === '[') {
        if (state.expectingValue) {
          // Enter array streaming mode
          state.valueStarted = true;
          state.valueType = 'array';
          state.inArrayValue = true;
          state.arrayIndex = 0;
          state.arrayItemBuffer = '';
          state.arrayItemDepth = 0;
          state.arrayItemType = 'unknown';
        }
        continue;
      }

      if (char === ']') {
        // This should be handled by array streaming logic above
        continue;
      }

      if (char === ':') {
        if (!state.expectingValue && state.currentKey) {
          state.expectingValue = true;
        }
        continue;
      }

      if (char === ',') {
        // Value complete (if we have one pending)
        if (state.valueStarted && state.buffer.length > 0) {
          if (state.valueType !== 'object' && state.valueType !== 'array') {
            const path = [...state.currentPath, state.currentKey].join('.');
            results.push({
              key: state.currentKey,
              value: parseValue(state.buffer, state.valueType),
              path,
            });
          }
        }
        state.buffer = '';
        state.valueStarted = false;
        state.expectingValue = false;
        state.valueType = 'unknown';
        state.expectingKey = true;
        state.currentKey = '';
        continue;
      }

      // Other characters - part of a value
      if (state.expectingValue) {
        if (!state.valueStarted) {
          state.valueStarted = true;
          // Detect value type
          if (char === 't' || char === 'f') {
            state.valueType = 'boolean';
          } else if (char === 'n') {
            state.valueType = 'null';
          } else if (char === '-' || (char >= '0' && char <= '9')) {
            state.valueType = 'number';
          }
        }
        state.buffer += char;
      }
    }

    return results;
  }

  /**
   * Check if a primitive value is complete
   */
  function isCompleteValue(value: string, type: ParserState['valueType']): boolean {
    if (type === 'boolean') {
      return value === 'true' || value === 'false';
    }
    if (type === 'null') {
      return value === 'null';
    }
    if (type === 'number') {
      // Number is complete if it's a valid number
      return !isNaN(Number(value)) && value.length > 0;
    }
    return false;
  }

  function getState(): ParserState {
    return { ...state };
  }

  function reset(): void {
    state = createInitialState();
  }

  return {
    process,
    getState,
    reset,
  };
}

export default createIncrementalParser;
