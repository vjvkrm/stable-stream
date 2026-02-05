/**
 * Test script: Simulates SSE streaming of form data through the parser
 *
 * Run with: npx tsx scripts/test-parser-form.ts
 */

import { createIncrementalParser } from '../packages/core/src/parser';

// Sample form data structures
const formExamples = {
  // Simple user profile
  userProfile: {
    firstName: "Alexander",
    lastName: "Thompson",
    email: "alex.thompson@example.com",
    age: 32,
    isVerified: true,
    bio: "Senior software engineer with 10+ years of experience in distributed systems and cloud architecture.",
    website: "https://alexthompson.dev",
    joinedAt: "2024-03-15T10:30:00Z",
  },

  // Contact form with nested address
  contactForm: {
    name: "Sarah Johnson",
    email: "sarah.j@company.com",
    phone: "+1-555-123-4567",
    subject: "Partnership Inquiry",
    message: "I would like to discuss a potential partnership opportunity for our upcoming project. Please let me know your availability for a call next week.",
    address: {
      street: "123 Innovation Drive",
      city: "San Francisco",
      state: "CA",
      zip: "94105",
      country: "USA",
    },
    preferredContact: "email",
    urgency: "normal",
  },

  // Settings form with various types
  settingsForm: {
    theme: "dark",
    language: "en-US",
    notifications: {
      email: true,
      push: false,
      sms: true,
      frequency: "daily",
    },
    privacy: {
      profileVisible: true,
      showEmail: false,
      allowIndexing: false,
    },
    quotaLimit: 1000,
    timezone: "America/Los_Angeles",
    features: ["beta", "advanced-analytics", "api-access"],
  },

  // E-commerce checkout form
  checkoutForm: {
    customer: {
      firstName: "Michael",
      lastName: "Chen",
      email: "m.chen@email.com",
    },
    shipping: {
      address: "456 Oak Street, Apt 7B",
      city: "New York",
      state: "NY",
      zip: "10001",
    },
    billing: {
      sameAsShipping: true,
    },
    items: [
      { sku: "LAPTOP-001", name: "Pro Laptop 15\"", quantity: 1, price: 1299.99 },
      { sku: "MOUSE-002", name: "Wireless Mouse", quantity: 2, price: 49.99 },
      { sku: "CASE-003", name: "Laptop Sleeve", quantity: 1, price: 29.99 },
    ],
    subtotal: 1429.96,
    tax: 128.70,
    total: 1558.66,
    paymentMethod: "credit_card",
    notes: "Please leave at front door if not home.",
  },
};

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

async function testFormData(name: string, data: object) {
  console.log('\n' + '='.repeat(60));
  console.log(`Form: ${name}`);
  console.log('='.repeat(60));

  const json = JSON.stringify(data);
  console.log(`JSON size: ${json.length} chars`);

  const parser = createIncrementalParser();
  const chunkSize = 30; // Smaller chunks to see more granular streaming
  const chunks = [...simulateSSEChunks(json, chunkSize)];

  console.log(`Streaming in ${chunks.length} chunks (~${chunkSize} chars each)`);
  console.log('-'.repeat(60));

  let chunkNum = 0;

  for (const chunk of chunks) {
    chunkNum++;
    const results = parser.process(chunk);

    if (results.length > 0) {
      for (const result of results) {
        // Format value for display
        let valueStr: string;
        if (typeof result.value === 'string') {
          valueStr = result.value.length > 40
            ? `"${result.value.slice(0, 40)}..."`
            : `"${result.value}"`;
        } else if (typeof result.value === 'object' && result.value !== null) {
          const keys = Object.keys(result.value);
          valueStr = `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
        } else {
          valueStr = String(result.value);
        }

        console.log(`  [${String(chunkNum).padStart(3)}] ${result.path.padEnd(25)} → ${valueStr}`);
      }
    }

    await delay(100); // Simulate streaming delay
  }

  console.log('-'.repeat(60));
}

async function main() {
  console.log('Parser Form Data Streaming Test');
  console.log('================================\n');
  console.log('Testing various form structures to see streaming behavior.\n');

  for (const [name, data] of Object.entries(formExamples)) {
    await testFormData(name, data);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All form tests complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
