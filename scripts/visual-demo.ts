/**
 * Visual Demo: Watch data fill in progressively
 *
 * Run with: npx tsx scripts/visual-demo.ts
 */

import { z } from "zod";
import { createStableStream } from "../packages/core/src/stream";

// Simulate LLM streaming with realistic delays
async function* simulateLLMStream(
  json: string,
  chunkSize = 8,
  delayMs = 50
): AsyncGenerator<string> {
  for (let i = 0; i < json.length; i += chunkSize) {
    await new Promise((r) => setTimeout(r, delayMs));
    yield json.slice(i, i + chunkSize);
  }
}

// ANSI colors for terminal
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bgGreen: "\x1b[42m",
};

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function renderForm(data: any, state: string, changedPaths: string[]) {
  clearScreen();

  console.log(colors.cyan + "═".repeat(80) + colors.reset);
  console.log(colors.cyan + "  FORM STREAMING DEMO - Employee Profile" + colors.reset);
  console.log(colors.cyan + "═".repeat(80) + colors.reset);
  console.log();

  const stateColor = state === "complete" ? colors.green : colors.yellow;
  console.log(`  State: ${stateColor}${state.toUpperCase()}${colors.reset}`);
  console.log();

  // Render form fields in two columns
  const fieldsLeft = [
    { label: "First Name", key: "firstName" },
    { label: "Last Name", key: "lastName" },
    { label: "Email", key: "email" },
    { label: "Phone", key: "phone" },
    { label: "Age", key: "age" },
    { label: "Date of Birth", key: "dateOfBirth" },
    { label: "Address", key: "address" },
    { label: "City", key: "city" },
    { label: "State", key: "state" },
    { label: "Zip Code", key: "zipCode" },
  ];

  const fieldsRight = [
    { label: "Company", key: "company" },
    { label: "Job Title", key: "jobTitle" },
    { label: "Department", key: "department" },
    { label: "Salary", key: "salary" },
    { label: "Start Date", key: "startDate" },
    { label: "Verified", key: "isVerified" },
    { label: "Active", key: "isActive" },
    { label: "Country", key: "country" },
    { label: "Website", key: "website" },
    { label: "Bio", key: "bio" },
  ];

  console.log("  ┌" + "─".repeat(36) + "┬" + "─".repeat(40) + "┐");
  console.log("  │" + " PERSONAL INFO".padEnd(36) + "│" + " EMPLOYMENT INFO".padEnd(40) + "│");
  console.log("  ├" + "─".repeat(36) + "┼" + "─".repeat(40) + "┤");

  const maxRows = Math.max(fieldsLeft.length, fieldsRight.length);
  for (let i = 0; i < maxRows; i++) {
    const leftField = fieldsLeft[i];
    const rightField = fieldsRight[i];

    let leftStr = "".padEnd(35);
    let rightStr = "".padEnd(39);

    if (leftField) {
      const value = data[leftField.key];
      const changed = changedPaths.includes(leftField.key);
      const displayValue = value === "" || value === 0 || value === false
        ? colors.dim + "(empty)" + colors.reset
        : String(value).slice(0, 18);
      const highlight = changed ? colors.bgGreen : "";
      leftStr = ` ${leftField.label.padEnd(14)}: ${highlight}${displayValue}${colors.reset}`.slice(0, 60).padEnd(35);
    }

    if (rightField) {
      const value = data[rightField.key];
      const changed = changedPaths.includes(rightField.key);
      const displayValue = value === "" || value === 0 || value === false
        ? colors.dim + "(empty)" + colors.reset
        : String(value).slice(0, 20);
      const highlight = changed ? colors.bgGreen : "";
      rightStr = ` ${rightField.label.padEnd(12)}: ${highlight}${displayValue}${colors.reset}`.slice(0, 65).padEnd(39);
    }

    console.log(`  │${leftStr}│${rightStr}│`);
  }

  console.log("  └" + "─".repeat(36) + "┴" + "─".repeat(40) + "┘");
  console.log();
  console.log(colors.dim + "  Changed: " + (changedPaths.join(", ") || "none") + colors.reset);
  console.log();
}

function renderTable(data: any, state: string, changedPaths: string[]) {
  clearScreen();

  console.log(colors.cyan + "═".repeat(130) + colors.reset);
  console.log(colors.cyan + "  TABLE STREAMING DEMO - Employee Directory" + colors.reset);
  console.log(colors.cyan + "═".repeat(130) + colors.reset);
  console.log();

  const stateColor = state === "complete" ? colors.green : colors.yellow;
  console.log(`  State: ${stateColor}${state.toUpperCase()}${colors.reset}`);
  console.log(`  Title: ${data.title || colors.dim + "(loading...)" + colors.reset}`);
  console.log();

  // Table header
  const colWidths = { id: 4, name: 14, email: 16, dept: 12, role: 14, salary: 9, date: 12, status: 8 };
  const headerLine = "─".repeat(126);

  console.log("  ┌" + headerLine + "┐");
  console.log(
    `  │ ${"ID".padEnd(colWidths.id)} │ ${"Name".padEnd(colWidths.name)} │ ${"Email".padEnd(colWidths.email)} │ ${"Department".padEnd(colWidths.dept)} │ ${"Role".padEnd(colWidths.role)} │ ${"Salary".padEnd(colWidths.salary)} │ ${"Start Date".padEnd(colWidths.date)} │ ${"Status".padEnd(colWidths.status)} │`
  );
  console.log("  ├" + headerLine + "┤");

  // Table rows
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const rowChanged = changedPaths.some((p) => p.startsWith(`rows[${i}]`));
    const highlight = rowChanged ? colors.bgGreen : "";
    const dim = colors.dim + "..." + colors.reset;

    const id = String(row.id || 0).padEnd(colWidths.id);
    const name = (row.name || dim).toString().slice(0, colWidths.name).padEnd(colWidths.name);
    const email = (row.email || dim).toString().slice(0, colWidths.email).padEnd(colWidths.email);
    const dept = (row.department || dim).toString().slice(0, colWidths.dept).padEnd(colWidths.dept);
    const role = (row.role || dim).toString().slice(0, colWidths.role).padEnd(colWidths.role);
    const salary = row.salary ? `$${(row.salary/1000).toFixed(0)}k`.padEnd(colWidths.salary) : dim.toString().padEnd(colWidths.salary);
    const date = (row.startDate || dim).toString().slice(0, colWidths.date).padEnd(colWidths.date);
    const status = (row.status || dim).toString().slice(0, colWidths.status).padEnd(colWidths.status);

    console.log(`  │ ${highlight}${id}${colors.reset} │ ${name} │ ${email} │ ${dept} │ ${role} │ ${salary} │ ${date} │ ${status} │`);
  }

  console.log("  └" + headerLine + "┘");
  console.log();
  console.log(colors.dim + `  Rows: ${data.rows.length} | Changed: ${changedPaths.length} paths` + colors.reset);
  console.log();
}

async function demoForm() {
  const FormSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string(),
    age: z.number(),
    dateOfBirth: z.string(),
    company: z.string(),
    jobTitle: z.string(),
    department: z.string(),
    salary: z.number(),
    startDate: z.string(),
    isVerified: z.boolean(),
    isActive: z.boolean(),
    bio: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    website: z.string(),
  });

  const formData = {
    firstName: "Alexander",
    lastName: "Thompson",
    email: "alex.thompson@example.com",
    phone: "+1 (555) 123-4567",
    age: 32,
    dateOfBirth: "1992-03-15",
    company: "TechCorp Industries",
    jobTitle: "Senior Software Engineer",
    department: "Platform Engineering",
    salary: 185000,
    startDate: "2021-06-01",
    isVerified: true,
    isActive: true,
    bio: "Senior software engineer with expertise in distributed systems and cloud architecture.",
    address: "123 Innovation Drive, Suite 400",
    city: "San Francisco",
    state: "California",
    zipCode: "94105",
    country: "United States",
    website: "https://alexthompson.dev",
  };

  console.log("\n🎬 Starting Form Demo...\n");
  await new Promise((r) => setTimeout(r, 1000));

  for await (const { data, state, changedPaths } of createStableStream({
    schema: FormSchema,
    source: simulateLLMStream(JSON.stringify(formData), 10, 80),
  })) {
    renderForm(data, state, changedPaths);
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(colors.green + "  ✓ Form complete!" + colors.reset);
  console.log();
}

async function demoTable() {
  const TableSchema = z.object({
    title: z.string(),
    rows: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        department: z.string(),
        role: z.string(),
        salary: z.number(),
        startDate: z.string(),
        status: z.string(),
      })
    ).min(10), // Pre-fill with 10 skeleton rows
  });

  const tableData = {
    title: "Employee Directory - Q4 2024",
    rows: [
      { id: 1, name: "Alice Chen", email: "alice@corp.com", department: "Engineering", role: "Senior Dev", salary: 145000, startDate: "2021-03-15", status: "active" },
      { id: 2, name: "Bob Smith", email: "bob@corp.com", department: "Engineering", role: "Tech Lead", salary: 175000, startDate: "2019-08-01", status: "active" },
      { id: 3, name: "Carol White", email: "carol@corp.com", department: "Design", role: "UX Lead", salary: 135000, startDate: "2020-01-10", status: "active" },
      { id: 4, name: "David Lee", email: "david@corp.com", department: "Product", role: "PM", salary: 155000, startDate: "2022-06-20", status: "active" },
      { id: 5, name: "Emma Davis", email: "emma@corp.com", department: "Engineering", role: "DevOps", salary: 140000, startDate: "2021-11-05", status: "active" },
      { id: 6, name: "Frank Miller", email: "frank@corp.com", department: "Sales", role: "Account Exec", salary: 125000, startDate: "2023-02-14", status: "pending" },
      { id: 7, name: "Grace Kim", email: "grace@corp.com", department: "Marketing", role: "Marketing Mgr", salary: 130000, startDate: "2022-09-01", status: "active" },
    ],
  };

  console.log("\n🎬 Starting Table Demo...\n");
  await new Promise((r) => setTimeout(r, 1000));

  for await (const { data, state, changedPaths } of createStableStream({
    schema: TableSchema,
    source: simulateLLMStream(JSON.stringify(tableData), 12, 100),
  })) {
    renderTable(data, state, changedPaths);
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(colors.green + "  ✓ Table complete! (trimmed from 10 skeleton rows to 7 actual)" + colors.reset);
  console.log();
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  STABLE-STREAM VISUAL DEMO");
  console.log("  Watch data fill in progressively as it streams");
  console.log("=".repeat(70));

  // Demo 1: Form
  await demoForm();
  await new Promise((r) => setTimeout(r, 2000));

  // Demo 2: Table
  await demoTable();

  console.log("\n" + "=".repeat(70));
  console.log("  Demo complete!");
  console.log("=".repeat(70) + "\n");
}

main().catch(console.error);
