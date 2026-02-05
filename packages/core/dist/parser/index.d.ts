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
    path: string;
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
    nestedDepth: number;
    inArrayValue: boolean;
    arrayIndex: number;
    arrayItemBuffer: string;
    arrayItemDepth: number;
    arrayItemType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'unknown';
}
export interface IncrementalParser {
    process(chunk: string): ParsedValue[];
    getState(): ParserState;
    reset(): void;
}
/**
 * Create an incremental JSON parser
 */
export declare function createIncrementalParser(): IncrementalParser;
export default createIncrementalParser;
//# sourceMappingURL=index.d.ts.map