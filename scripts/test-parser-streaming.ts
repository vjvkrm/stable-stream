/**
 * Test script: Simulates SSE streaming of dashboard data through the parser
 *
 * Run with: npx tsx scripts/test-parser-streaming.ts
 */

import { createIncrementalParser } from '../packages/core/src/parser';

// Generate dashboard data: 30 rows × 20 columns
function generateDashboardData(rows: number, cols: number) {
  const data: Record<string, unknown> = {
    title: "Sales Dashboard Q1 2026",
    generatedAt: new Date().toISOString(),
    rows: [] as Record<string, unknown>[],
  };

  for (let r = 0; r < rows; r++) {
    const row: Record<string, unknown> = {
      id: r + 1,
      name: `Product ${r + 1}`,
    };

    for (let c = 0; c < cols - 2; c++) {
      const colName = `metric_${c + 1}`;
      row[colName] = Math.round(Math.random() * 10000) / 100;
    }

    (data.rows as Record<string, unknown>[]).push(row);
  }

  return data;
}

// Simulate SSE streaming by chunking the JSON
function* simulateSSEChunks(json: string, chunkSize: number): Generator<string> {
  for (let i = 0; i < json.length; i += chunkSize) {
    yield json.slice(i, i + chunkSize);
  }
}

// Add delay to simulate network latency
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('Parser Streaming Test: 30 rows × 20 columns dashboard');
  console.log('='.repeat(60));
  console.log();

  // Generate data
  const dashboardData = generateDashboardData(30, 20);
  const json = JSON.stringify(dashboardData);

  console.log(`Generated JSON size: ${json.length} characters`);
  console.log();

  // Create parser
  const parser = createIncrementalParser();

  // Simulate streaming with different chunk sizes
  const chunkSize = 50; // Small chunks to see incremental behavior
  const chunks = [...simulateSSEChunks(json, chunkSize)];

  console.log(`Streaming in ${chunks.length} chunks of ~${chunkSize} chars each`);
  console.log(`Simulating ~30ms delay per chunk (like real LLM streaming)`);
  console.log('-'.repeat(60));
  console.log();

  let totalValues = 0;
  let chunkNum = 0;

  console.log('Starting stream...\n');

  for (const chunk of chunks) {
    chunkNum++;

    // Show streaming progress with dots
    process.stdout.write('.');

    // Process chunk
    const results = parser.process(chunk);

    if (results.length > 0) {
      // Clear the dots line and show the value
      process.stdout.write('\n');

      for (const result of results) {
        totalValues++;

        // Format the value for display
        let valuePreview: string;
        if (Array.isArray(result.value)) {
          valuePreview = `Array(${result.value.length} items)`;
        } else if (typeof result.value === 'object' && result.value !== null) {
          const keys = Object.keys(result.value);
          valuePreview = `Object(${keys.length} keys: ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''})`;
        } else if (typeof result.value === 'string' && result.value.length > 50) {
          valuePreview = `"${result.value.slice(0, 50)}..."`;
        } else {
          valuePreview = JSON.stringify(result.value);
        }

        console.log(`\n✅ VALUE EXTRACTED [chunk ${chunkNum}/${chunks.length}]`);
        console.log(`   Key:   ${result.key}`);
        console.log(`   Value: ${valuePreview}`);
        console.log(`   Path:  ${result.path}`);
        console.log();
      }
    }

    // Delay to simulate real LLM streaming speed (~30ms per chunk)
    await delay(30);
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('Streaming complete!');
  console.log(`Total chunks processed: ${chunkNum}`);
  console.log(`Total values extracted: ${totalValues}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
