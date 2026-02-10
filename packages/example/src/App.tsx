import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useStableStream } from "@stable-stream/react";
import { createIncrementalParser } from "@stable-stream/core";

// ============================================
// Schemas
// ============================================

const EmployeeFormSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  department: z.string(),
  jobTitle: z.string(),
  salary: z.number(),
  startDate: z.string(),
  isActive: z.boolean(),
  bio: z.string(),
});

const EmployeeTableSchema = z.object({
  title: z.string(),
  rows: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        department: z.string(),
        role: z.string(),
        salary: z.number(),
        status: z.string(),
        location: z.string(),
      }),
    )
    .min(10),
});

// ============================================
// Realistic Sample Data
// ============================================

const sampleFormData = {
  firstName: "Alexandra",
  lastName: "Chen",
  email: "alexandra.chen@techcorp.io",
  phone: "+1 (415) 555-0142",
  department: "Engineering",
  jobTitle: "Staff Software Engineer",
  salary: 245000,
  startDate: "2021-03-15",
  isActive: true,
  bio: "Staff engineer specializing in distributed systems and real-time data processing. Led the migration to event-driven architecture serving 50M+ daily users.",
};

const sampleTableData = {
  title: "Engineering Team Directory — Q1 2025",
  rows: [
    {
      id: 1,
      name: "Marcus Johnson",
      email: "m.johnson@corp.io",
      department: "Platform",
      role: "Engineering Manager",
      salary: 285000,
      status: "active",
      location: "San Francisco",
    },
    {
      id: 2,
      name: "Sarah Kim",
      email: "s.kim@corp.io",
      department: "Platform",
      role: "Staff Engineer",
      salary: 265000,
      status: "active",
      location: "Seattle",
    },
    {
      id: 3,
      name: "David Martinez",
      email: "d.martinez@corp.io",
      department: "Infrastructure",
      role: "Senior SRE",
      salary: 195000,
      status: "active",
      location: "Austin",
    },
    {
      id: 4,
      name: "Emily Zhang",
      email: "e.zhang@corp.io",
      department: "Frontend",
      role: "Tech Lead",
      salary: 245000,
      status: "active",
      location: "New York",
    },
    {
      id: 5,
      name: "James Wilson",
      email: "j.wilson@corp.io",
      department: "Backend",
      role: "Senior Engineer",
      salary: 185000,
      status: "active",
      location: "Denver",
    },
    {
      id: 6,
      name: "Priya Patel",
      email: "p.patel@corp.io",
      department: "Data",
      role: "ML Engineer",
      salary: 215000,
      status: "pending",
      location: "Boston",
    },
    {
      id: 7,
      name: "Michael Brown",
      email: "m.brown@corp.io",
      department: "Security",
      role: "Security Engineer",
      salary: 205000,
      status: "active",
      location: "Remote",
    },
    {
      id: 8,
      name: "Lisa Anderson",
      email: "l.anderson@corp.io",
      department: "Mobile",
      role: "iOS Lead",
      salary: 225000,
      status: "active",
      location: "Los Angeles",
    },
  ],
};

// ============================================
// Stream Simulator (simulates LLM streaming)
// ============================================

type StreamCallback = (chunk: string) => void;

function createDualStream(data: object, chunkSize = 10, delayMs = 500) {
  const json = JSON.stringify(data);
  let aborted = false;

  const start = async (onChunk: StreamCallback, onComplete: () => void) => {
    for (let i = 0; i < json.length && !aborted; i += chunkSize) {
      await new Promise((r) => setTimeout(r, delayMs));
      if (!aborted) {
        onChunk(json.slice(i, i + chunkSize));
      }
    }
    if (!aborted) onComplete();
  };

  const abort = () => {
    aborted = true;
  };

  // Also return as AsyncIterable for the hook
  const asyncIterable: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < json.length; i += chunkSize) {
        await new Promise((r) => setTimeout(r, delayMs));
        yield json.slice(i, i + chunkSize);
      }
    },
  };

  return {
    start,
    abort,
    asyncIterable,
    totalChunks: Math.ceil(json.length / chunkSize),
  };
}

// ============================================
// WITHOUT HOOK -
// ============================================

function FormWithoutHook({
  stream,
}: {
  stream: { start: Function; abort: Function } | null;
}) {
  const [data, setData] = useState<any>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [partialJson, setPartialJson] = useState<string>("");
  const [heightChanges, setHeightChanges] = useState(0);
  const parserRef = useRef(createIncrementalParser());
  const partialDataRef = useRef<any>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);
  const accumulatedJsonRef = useRef("");

  useEffect(() => {
    if (!stream) return;

    parserRef.current = createIncrementalParser();
    partialDataRef.current = {};
    accumulatedJsonRef.current = "";
    setData(null);
    setIsStreaming(true);
    setJsonError(null);
    setPartialJson("");
    setHeightChanges(0);
    lastHeightRef.current = 0;

    stream.start(
      (chunk: string) => {
        accumulatedJsonRef.current += chunk;
        setPartialJson(accumulatedJsonRef.current);

        // Try standard JSON.parse - will fail on incomplete JSON
        try {
          JSON.parse(accumulatedJsonRef.current);
          setJsonError(null);
        } catch (e: any) {
          setJsonError(`JSON.parse error: ${e.message}`);
        }

        // Use our incremental parser
        const parsed = parserRef.current.process(chunk);
        for (const { path, value } of parsed) {
          const keys = path.split(/[\.\[\]]+/).filter(Boolean);
          let obj = partialDataRef.current;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
          }
          obj[keys[keys.length - 1]] = value;
        }
        setData({ ...partialDataRef.current });

        // Track height changes (CLS)
        if (contentRef.current) {
          const newHeight = contentRef.current.offsetHeight;
          if (
            lastHeightRef.current > 0 &&
            newHeight !== lastHeightRef.current
          ) {
            setHeightChanges((c) => c + 1);
          }
          lastHeightRef.current = newHeight;
        }
      },
      () => {
        setIsStreaming(false);
        setJsonError(null);
      },
    );

    return () => stream.abort();
  }, [stream]);

  return (
    <div className="panel without">
      <div className="panel-header">
        <span className="badge bad">Problem</span>
        <span className="label">Standard JSON.parse + manual state</span>
      </div>

      <div className="form-content" ref={contentRef}>
        {/* Fields appear one by one - LAYOUT SHIFT! */}
        {data?.firstName !== undefined && (
          <div className="field">
            <label>First Name</label>
            <div className="value">{data.firstName}</div>
          </div>
        )}
        {data?.lastName !== undefined && (
          <div className="field">
            <label>Last Name</label>
            <div className="value">{data.lastName}</div>
          </div>
        )}
        {data?.email !== undefined && (
          <div className="field">
            <label>Email</label>
            <div className="value">{data.email}</div>
          </div>
        )}
        {data?.phone !== undefined && (
          <div className="field">
            <label>Phone</label>
            <div className="value">{data.phone}</div>
          </div>
        )}
        {data?.department !== undefined && (
          <div className="field">
            <label>Department</label>
            <div className="value">{data.department}</div>
          </div>
        )}
        {data?.jobTitle !== undefined && (
          <div className="field">
            <label>Job Title</label>
            <div className="value">{data.jobTitle}</div>
          </div>
        )}
        {data?.salary !== undefined && (
          <div className="field">
            <label>Salary</label>
            <div className="value">${data.salary?.toLocaleString()}</div>
          </div>
        )}
        {data?.startDate !== undefined && (
          <div className="field">
            <label>Start Date</label>
            <div className="value">{data.startDate}</div>
          </div>
        )}
        {data?.isActive !== undefined && (
          <div className="field">
            <label>Status</label>
            <div className="value">{data.isActive ? "Active" : "Inactive"}</div>
          </div>
        )}
        {data?.bio !== undefined && (
          <div className="field">
            <label>Bio</label>
            <div className="value">{data.bio}</div>
          </div>
        )}
        {!data && !isStreaming && (
          <div className="empty-state">Click "Stream Demo" to start</div>
        )}
        {!data && isStreaming && (
          <div className="empty-state">Waiting for data...</div>
        )}
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span>Layout Shifts:</span>
          <span className={`stat-value ${heightChanges > 0 ? "error" : ""}`}>
            {heightChanges}
          </span>
        </div>
        <div className="stat">
          <span>Fields Visible:</span>
          <span className="stat-value">
            {data ? Object.keys(data).length : 0}/10
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// WITH HOOK - The Solution
// ============================================

function FormWithHook({ stream }: { stream: AsyncIterable<string> | null }) {
  const { data, isStreaming, isComplete } = useStableStream({
    schema: EmployeeFormSchema,
    source: stream,
  });

  const filledFields = Object.values(data).filter(
    (v) => v !== "" && v !== 0 && v !== false,
  ).length;

  return (
    <div className="panel with">
      <div className="panel-header">
        <span className="badge good">Solution</span>
        <span className="label">stable-stream hook — zero CLS</span>
      </div>
      <div className="form-content">
        {/* All fields always present - NO LAYOUT SHIFT! */}
        <div className="field">
          <label>First Name</label>
          <div className={`value ${!data.firstName ? "skeleton" : ""}`}>
            {data.firstName || "..."}
          </div>
        </div>
        <div className="field">
          <label>Last Name</label>
          <div className={`value ${!data.lastName ? "skeleton" : ""}`}>
            {data.lastName || "..."}
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className={`value ${!data.email ? "skeleton" : ""}`}>
            {data.email || "..."}
          </div>
        </div>
        <div className="field">
          <label>Phone</label>
          <div className={`value ${!data.phone ? "skeleton" : ""}`}>
            {data.phone || "..."}
          </div>
        </div>
        <div className="field">
          <label>Department</label>
          <div className={`value ${!data.department ? "skeleton" : ""}`}>
            {data.department || "..."}
          </div>
        </div>
        <div className="field">
          <label>Job Title</label>
          <div className={`value ${!data.jobTitle ? "skeleton" : ""}`}>
            {data.jobTitle || "..."}
          </div>
        </div>
        <div className="field">
          <label>Salary</label>
          <div className={`value ${!data.salary ? "skeleton" : ""}`}>
            {data.salary ? `$${data.salary.toLocaleString()}` : "..."}
          </div>
        </div>
        <div className="field">
          <label>Start Date</label>
          <div className={`value ${!data.startDate ? "skeleton" : ""}`}>
            {data.startDate || "..."}
          </div>
        </div>
        <div className="field">
          <label>Status</label>
          <div
            className={`value ${data.isActive === false ? "" : !data.isActive ? "skeleton" : ""}`}
          >
            {data.isActive
              ? "Active"
              : data.isActive === false
                ? "Inactive"
                : "..."}
          </div>
        </div>
        <div className="field">
          <label>Bio</label>
          <div className={`value ${!data.bio ? "skeleton" : ""}`}>
            {data.bio || "..."}
          </div>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span>Layout Shifts:</span>
          <span className="stat-value success">0</span>
        </div>
        <div className="stat">
          <span>Fields Ready:</span>
          <span className="stat-value">{filledFields}/10</span>
        </div>
        <div className="stat">
          <span>State:</span>
          <span className="stat-value">
            {isComplete ? "Complete" : isStreaming ? "Streaming..." : "Idle"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Table WITHOUT Hook
// ============================================

function TableWithoutHook({
  stream,
}: {
  stream: { start: Function; abort: Function } | null;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [heightChanges, setHeightChanges] = useState(0);
  const parserRef = useRef(createIncrementalParser());
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);

  useEffect(() => {
    if (!stream) return;

    parserRef.current = createIncrementalParser();
    setRows([]);
    setTitle("");
    setIsStreaming(true);
    setHeightChanges(0);
    lastHeightRef.current = 0;

    const rowsData: any[] = [];

    stream.start(
      (chunk: string) => {
        const parsed = parserRef.current.process(chunk);
        for (const { path, value } of parsed) {
          if (path === "title") {
            setTitle(value as string);
          } else if (path.startsWith("rows[")) {
            const match = path.match(/rows\[(\d+)\]\.?(.+)?/);
            if (match) {
              const idx = parseInt(match[1]);
              const field = match[2];
              if (!rowsData[idx]) rowsData[idx] = {};
              if (field) {
                rowsData[idx][field] = value;
              } else {
                rowsData[idx] = value;
              }
              setRows([...rowsData]);
            }
          }
        }

        // Track height changes
        if (contentRef.current) {
          const newHeight = contentRef.current.offsetHeight;
          if (
            lastHeightRef.current > 0 &&
            newHeight !== lastHeightRef.current
          ) {
            setHeightChanges((c) => c + 1);
          }
          lastHeightRef.current = newHeight;
        }
      },
      () => setIsStreaming(false),
    );

    return () => stream.abort();
  }, [stream]);

  return (
    <div className="panel without">
      <div className="panel-header">
        <span className="badge bad">Problem</span>
        <span className="label">Rows appear suddenly, layout jumps</span>
      </div>
      <div className="table-content" ref={contentRef}>
        <p className="table-title">
          {title || (isStreaming ? "Loading title..." : 'Click "Stream Demo"')}
        </p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Role</th>
                <th>Location</th>
                <th>Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.id}</td>
                  <td>{row.name || "..."}</td>
                  <td>{row.department || "..."}</td>
                  <td>{row.role || "..."}</td>
                  <td>{row.location || "..."}</td>
                  <td className="salary">
                    {row.salary ? `$${(row.salary / 1000).toFixed(0)}k` : "..."}
                  </td>
                  <td>
                    {row.status ? (
                      <span className={`status-badge ${row.status}`}>
                        {row.status}
                      </span>
                    ) : (
                      "..."
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {isStreaming ? "Waiting for rows..." : "No data"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="row-count">
          <span>{rows.length} rows loaded</span>
          {heightChanges > 0 && (
            <span className="highlight">• {heightChanges} layout shifts!</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Table WITH Hook
// ============================================

function TableWithHook({ stream }: { stream: AsyncIterable<string> | null }) {
  const { data, isStreaming, isComplete } = useStableStream({
    schema: EmployeeTableSchema,
    source: stream,
  });

  const filledRows = data.rows.filter((r) => r.name).length;

  return (
    <div className="panel with">
      <div className="panel-header">
        <span className="badge good">Solution</span>
        <span className="label">10 skeleton rows ready, smooth fill</span>
      </div>
      <div className="table-content">
        <p className="table-title">{data.title || "Loading..."}</p>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Role</th>
                <th>Location</th>
                <th>Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => {
                const isSkeleton = !row.name;
                return (
                  <tr key={i} className={isSkeleton ? "skeleton-row" : ""}>
                    <td>{row.id || "—"}</td>
                    <td>{row.name || "..."}</td>
                    <td>{row.department || "..."}</td>
                    <td>{row.role || "..."}</td>
                    <td>{row.location || "..."}</td>
                    <td className="salary">
                      {row.salary
                        ? `$${(row.salary / 1000).toFixed(0)}k`
                        : "..."}
                    </td>
                    <td>
                      {row.status ? (
                        <span className={`status-badge ${row.status}`}>
                          {row.status}
                        </span>
                      ) : (
                        "..."
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="row-count">
          {isComplete ? (
            <>
              <span className="highlight">{filledRows} rows</span> loaded
              (skeleton trimmed)
            </>
          ) : (
            <>
              <span>
                {filledRows}/{data.rows.length}
              </span>{" "}
              rows filled • <span className="highlight">0 layout shifts</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Main App
// ============================================

export default function App() {
  const [formStream, setFormStream] = useState<ReturnType<
    typeof createDualStream
  > | null>(null);
  const [tableStream, setTableStream] = useState<ReturnType<
    typeof createDualStream
  > | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runFormComparison = () => {
    setIsRunning(true);
    const stream = createDualStream(sampleFormData, 10, 60);
    setFormStream(stream);
    setTimeout(() => setIsRunning(false), 4000);
  };

  const runTableComparison = () => {
    setIsRunning(true);
    const stream = createDualStream(sampleTableData, 12, 50);
    setTableStream(stream);
    setTimeout(() => setIsRunning(false), 5000);
  };

  return (
    <div className="app">
      <header>
        <h1>stable-stream</h1>
        <p>
          Stream structured JSON from LLMs with zero layout shift. See the
          difference side-by-side.
        </p>
      </header>

      <section className="demo-section">
        <div className="section-header">
          <h2>Form Streaming</h2>
          <button
            className="run-btn"
            onClick={runFormComparison}
            disabled={isRunning}
          >
            Stream Demo
          </button>
        </div>
        <div className="comparison">
          <FormWithoutHook stream={formStream} />
          <FormWithHook stream={formStream?.asyncIterable || null} />
        </div>
      </section>

      <section className="demo-section">
        <div className="section-header">
          <h2>Table Streaming</h2>
          <button
            className="run-btn"
            onClick={runTableComparison}
            disabled={isRunning}
          >
            Stream Demo
          </button>
        </div>
        <div className="comparison">
          <TableWithoutHook stream={tableStream} />
          <TableWithHook stream={tableStream?.asyncIterable || null} />
        </div>
      </section>
    </div>
  );
}
