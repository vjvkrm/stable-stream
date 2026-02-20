import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useStableStream } from "@stable-stream/react";
import { createIncrementalParser } from "@stable-stream/core";

type DemoScenario = "normal" | "hallucinations" | "truncated" | "source_error";

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

type StreamStart = (
  onChunk: StreamCallback,
  onComplete: () => void,
  onError?: (err: Error) => void,
) => Promise<void>;

function injectHallucinations(data: object): object {
  return {
    ...data,
    admin: true,
    debug: {
      traceId: "trace_demo_123",
      notes: "these keys are not in the schema and should be ignored",
    },
  };
}

function createDualStream(
  data: object,
  chunkSize = 10,
  delayMs = 500,
  scenario: DemoScenario = "normal",
) {
  const payload = scenario === "hallucinations" ? injectHallucinations(data) : data;
  const json = JSON.stringify(payload);
  let aborted = false;

  const maxLen =
    scenario === "truncated" ? Math.max(0, Math.floor(json.length * 0.7)) : json.length;
  const errorAtChunk = 6;
  const plannedChunks = Math.ceil(maxLen / chunkSize);
  const estimatedChunks =
    scenario === "source_error" ? Math.min(plannedChunks, errorAtChunk) : plannedChunks;

  const start: StreamStart = async (onChunk, onComplete, onError) => {
    try {
      let chunkIndex = 0;
      for (let i = 0; i < maxLen && !aborted; i += chunkSize) {
        await new Promise((r) => setTimeout(r, delayMs));
        if (aborted) break;
        if (scenario === "source_error" && chunkIndex === errorAtChunk) {
          throw new Error("Simulated source error");
        }
        onChunk(json.slice(i, Math.min(i + chunkSize, maxLen)));
        chunkIndex++;
      }
      if (!aborted) onComplete();
    } catch (err) {
      if (aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
    }
  };

  const abort = () => {
    aborted = true;
  };

  // Also return as AsyncIterable for the hook
  const asyncIterable: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      let chunkIndex = 0;
      for (let i = 0; i < maxLen; i += chunkSize) {
        await new Promise((r) => setTimeout(r, delayMs));
        if (aborted) return;
        if (scenario === "source_error" && chunkIndex === errorAtChunk) {
          throw new Error("Simulated source error");
        }
        yield json.slice(i, Math.min(i + chunkSize, maxLen));
        chunkIndex++;
      }
    },
  };

  return {
    start,
    abort,
    asyncIterable,
    totalChunks: estimatedChunks,
    estimatedDurationMs: estimatedChunks * delayMs,
  };
}

// ============================================
// Raw Stream Viewer
// ============================================

function RawStreamTerminal({
  chunks,
  isStreaming,
}: {
  chunks: string[];
  isStreaming: boolean;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [chunks]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className={`terminal-title ${isStreaming ? "streaming" : ""}`}>
          RAW LLM STREAM (JSON)
        </div>
      </div>
      <div className="terminal-content" ref={terminalRef}>
        {chunks.map((chunk, i) => (
          <span key={i} className="chunk">
            {chunk}
          </span>
        ))}
        {isStreaming && <span className="terminal-cursor" />}
      </div>
    </div>
  );
}

// ============================================
// WITHOUT HOOK -
// ============================================

function FormWithoutHook({
  stream,
}: {
  stream: { start: StreamStart; abort: () => void } | null;
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

        // Do not surface raw JSON.parse errors for partial chunks.
        // We'll keep a partial preview but avoid alarming technical errors.

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
        // If final parse fails, surface a friendly message instead of raw parse text.
        try {
          JSON.parse(accumulatedJsonRef.current);
          setJsonError(null);
        } catch (_) {
          setJsonError("Received truncated or invalid JSON (partial result)");
        }
      },
      (err: Error) => {
        setIsStreaming(false);
        setJsonError(`Source error: ${err.message}`);
      },
    );

    return () => stream.abort();
  }, [stream]);

  return (
    <div className="panel without">
      <div className="panel-header">
        <span className="badge bad">Problem</span>
        <span className="label">JSON.parse fails mid-stream, state is manual</span>
      </div>

      {jsonError && (
        <div className="json-error">
          <div className="json-error-title">Streaming (partial data)</div>
          <div>{jsonError}</div>
          {partialJson && (
            <div className="json-partial">
              {partialJson.length > 180
                ? `…${partialJson.slice(-180)}`
                : partialJson}
            </div>
          )}
        </div>
      )}

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
        <div className="stat">
          <span>State:</span>
          <span className="stat-value">
            {isStreaming ? "Streaming..." : data ? "Done" : "Idle"}
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
  const {
    data,
    isStreaming,
    isComplete,
    isPartial,
    completionReason,
    error,
    changedPaths,
  } = useStableStream({
    schema: EmployeeFormSchema,
    source: stream,
  });

  const [seenPaths, setSeenPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSeenPaths(new Set());
  }, [stream]);

  useEffect(() => {
    if (changedPaths.length === 0) return;
    setSeenPaths((prev) => {
      const next = new Set(prev);
      for (const p of changedPaths) next.add(p);
      return next;
    });
  }, [changedPaths]);

  const isReady = (path: string) => seenPaths.has(path);
  const readyCount = seenPaths.size;

  return (
    <div className="panel with">
      <div className="panel-header">
        <span className="badge good">Solution</span>
        <span className="label">stable-stream hook — zero CLS</span>
      </div>

      {error && (
        <div className="json-error">
          <div className="json-error-title">Stream error</div>
          <div>{error.message}</div>
        </div>
      )}

      <div className="form-content">
        {/* All fields always present - NO LAYOUT SHIFT! */}
        <div className="field">
          <label>First Name</label>
          <div className={`value ${!isReady("firstName") ? "skeleton" : ""}`}>
            {data.firstName || "..."}
          </div>
        </div>
        <div className="field">
          <label>Last Name</label>
          <div className={`value ${!isReady("lastName") ? "skeleton" : ""}`}>
            {data.lastName || "..."}
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <div className={`value ${!isReady("email") ? "skeleton" : ""}`}>
            {data.email || "..."}
          </div>
        </div>
        <div className="field">
          <label>Phone</label>
          <div className={`value ${!isReady("phone") ? "skeleton" : ""}`}>
            {data.phone || "..."}
          </div>
        </div>
        <div className="field">
          <label>Department</label>
          <div className={`value ${!isReady("department") ? "skeleton" : ""}`}>
            {data.department || "..."}
          </div>
        </div>
        <div className="field">
          <label>Job Title</label>
          <div className={`value ${!isReady("jobTitle") ? "skeleton" : ""}`}>
            {data.jobTitle || "..."}
          </div>
        </div>
        <div className="field">
          <label>Salary</label>
          <div className={`value ${!isReady("salary") ? "skeleton" : ""}`}>
            {data.salary ? `$${data.salary.toLocaleString()}` : "..."}
          </div>
        </div>
        <div className="field">
          <label>Start Date</label>
          <div className={`value ${!isReady("startDate") ? "skeleton" : ""}`}>
            {data.startDate || "..."}
          </div>
        </div>
        <div className="field">
          <label>Status</label>
          <div className={`value ${!isReady("isActive") ? "skeleton" : ""}`}>
            {isReady("isActive") ? (data.isActive ? "Active" : "Inactive") : "..."}
          </div>
        </div>
        <div className="field">
          <label>Bio</label>
          <div className={`value ${!isReady("bio") ? "skeleton" : ""}`}>
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
          <span className="stat-value">{Math.min(readyCount, 10)}/10</span>
        </div>
        <div className="stat">
          <span>State:</span>
          <span className="stat-value">
            {isComplete
              ? isPartial
                ? "Partial"
                : "Complete"
              : isStreaming
                ? "Streaming..."
                : "Idle"}
          </span>
        </div>
        <div className="stat">
          <span>Reason:</span>
          <span className="stat-value">{completionReason ?? "—"}</span>
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
  stream: { start: StreamStart; abort: () => void } | null;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [heightChanges, setHeightChanges] = useState(0);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [partialJson, setPartialJson] = useState<string>("");
  const parserRef = useRef(createIncrementalParser());
  const contentRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);
  const accumulatedJsonRef = useRef("");

  useEffect(() => {
    if (!stream) return;

    parserRef.current = createIncrementalParser();
    setRows([]);
    setTitle("");
    setIsStreaming(true);
    setHeightChanges(0);
    setJsonError(null);
    setPartialJson("");
    accumulatedJsonRef.current = "";
    lastHeightRef.current = 0;

    const rowsData: any[] = [];

    stream.start(
      (chunk: string) => {
        accumulatedJsonRef.current += chunk;
        setPartialJson(accumulatedJsonRef.current);
        // Do not surface raw JSON.parse errors while streaming partial chunks.

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
      () => {
        setIsStreaming(false);
        try {
          JSON.parse(accumulatedJsonRef.current);
          setJsonError(null);
        } catch (_) {
          setJsonError("Received truncated or invalid JSON (partial result)");
        }
      },
      (err: Error) => {
        setIsStreaming(false);
        setJsonError(`Source error: ${err.message}`);
      },
    );

    return () => stream.abort();
  }, [stream]);

  return (
    <div className="panel without">
      <div className="panel-header">
        <span className="badge bad">Problem</span>
        <span className="label">Rows appear suddenly, layout jumps</span>
      </div>

      {jsonError && (
        <div className="json-error">
          <div className="json-error-title">Streaming (partial data)</div>
          <div>{jsonError}</div>
          {partialJson && (
            <div className="json-partial">
              {partialJson.length > 180
                ? `…${partialJson.slice(-180)}`
                : partialJson}
            </div>
          )}
        </div>
      )}

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
  const { data, isComplete, isPartial, completionReason, error } =
    useStableStream({
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

      {error && (
        <div className="json-error">
          <div className="json-error-title">Stream error</div>
          <div>{error.message}</div>
        </div>
      )}

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
              {isPartial ? " (partial)" : " (skeleton trimmed)"} •{" "}
              <span className="highlight">{completionReason}</span>
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

  // Raw chunks state
  const [rawChunks, setRawChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("normal");

  const runFormComparison = () => {
    setIsStreaming(true);
    setRawChunks([]);
    const stream = createDualStream(sampleFormData, 10, 60, scenario);
    
    // Intercept chunks for the terminal
    const originalStart = stream.start;
    stream.start = async (onChunk, onComplete, onError) => {
      const wrappedOnChunk = (chunk: string) => {
        setRawChunks((prev) => [...prev, chunk]);
        onChunk(chunk);
      };
      return originalStart(wrappedOnChunk, onComplete, onError);
    };

    setFormStream(stream);
    setTimeout(() => setIsStreaming(false), stream.estimatedDurationMs + 400);
  };

  const runTableComparison = () => {
    setIsStreaming(true);
    setRawChunks([]);
    const stream = createDualStream(sampleTableData, 12, 50, scenario);

    // Intercept chunks for the terminal
    const originalStart = stream.start;
    stream.start = async (onChunk, onComplete, onError) => {
      const wrappedOnChunk = (chunk: string) => {
        setRawChunks((prev) => [...prev, chunk]);
        onChunk(chunk);
      };
      return originalStart(wrappedOnChunk, onComplete, onError);
    };

    setTableStream(stream);
    setTimeout(() => setIsStreaming(false), stream.estimatedDurationMs + 400);
  };

  return (
    <div className="app">
      <header>
        <h1>stable-stream</h1>
        <p>
          Stream structured JSON from LLMs with zero layout shift. See the
          difference side-by-side.
        </p>
        <div className="controls">
          <div className="control">
            <label>Scenario</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as DemoScenario)}
            >
              <option value="normal">Normal</option>
              <option value="hallucinations">Hallucinated extra keys</option>
              <option value="truncated">Truncated JSON</option>
              <option value="source_error">Source error</option>
            </select>
          </div>
          <div className="control-hint">
            Applies to both demos. Truncated/source error should show{" "}
            <code>completionReason</code>.
          </div>
        </div>
      </header>

      <section className="demo-section">
        <div className="section-header">
          <h2>Form Streaming</h2>
          <button
            className="run-btn"
            onClick={runFormComparison}
            disabled={isStreaming}
          >
            Stream Demo
          </button>
        </div>
        
        {formStream && (
          <RawStreamTerminal chunks={rawChunks} isStreaming={isStreaming} />
        )}

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
            disabled={isStreaming}
          >
            Stream Demo
          </button>
        </div>

        {tableStream && (
          <RawStreamTerminal chunks={rawChunks} isStreaming={isStreaming} />
        )}

        <div className="comparison">
          <TableWithoutHook stream={tableStream} />
          <TableWithHook stream={tableStream?.asyncIterable || null} />
        </div>
      </section>
    </div>
  );
}
