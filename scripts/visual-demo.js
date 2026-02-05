"use strict";
/**
 * Visual Demo: Watch data fill in progressively
 *
 * Run with: npx tsx scripts/visual-demo.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var zod_1 = require("zod");
var stream_1 = require("../packages/core/src/stream");
// Simulate LLM streaming with realistic delays
function simulateLLMStream(json_1) {
    return __asyncGenerator(this, arguments, function simulateLLMStream_1(json, chunkSize, delayMs) {
        var i;
        if (chunkSize === void 0) { chunkSize = 8; }
        if (delayMs === void 0) { delayMs = 50; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < json.length)) return [3 /*break*/, 6];
                    return [4 /*yield*/, __await(new Promise(function (r) { return setTimeout(r, delayMs); }))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, __await(json.slice(i, i + chunkSize))];
                case 3: return [4 /*yield*/, _a.sent()];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    i += chunkSize;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ANSI colors for terminal
var colors = {
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
function renderForm(data, state, changedPaths) {
    clearScreen();
    console.log(colors.cyan + "═".repeat(60) + colors.reset);
    console.log(colors.cyan + "  FORM STREAMING DEMO" + colors.reset);
    console.log(colors.cyan + "═".repeat(60) + colors.reset);
    console.log();
    var stateColor = state === "complete" ? colors.green : colors.yellow;
    console.log("  State: ".concat(stateColor).concat(state.toUpperCase()).concat(colors.reset));
    console.log();
    // Render form fields
    var fields = [
        { label: "First Name", key: "firstName" },
        { label: "Last Name", key: "lastName" },
        { label: "Email", key: "email" },
        { label: "Age", key: "age" },
        { label: "Verified", key: "isVerified" },
        { label: "Bio", key: "bio" },
    ];
    for (var _i = 0, fields_1 = fields; _i < fields_1.length; _i++) {
        var field = fields_1[_i];
        var value = data[field.key];
        var changed = changedPaths.includes(field.key);
        var displayValue = value === "" || value === 0 || value === false
            ? colors.dim + "(empty)" + colors.reset
            : String(value);
        var highlight = changed ? colors.bgGreen : "";
        console.log("  ".concat(field.label.padEnd(12), ": ").concat(highlight).concat(displayValue).concat(colors.reset));
    }
    console.log();
    console.log(colors.dim + "  Changed: " + (changedPaths.join(", ") || "none") + colors.reset);
    console.log();
}
function renderTable(data, state, changedPaths) {
    clearScreen();
    console.log(colors.cyan + "═".repeat(70) + colors.reset);
    console.log(colors.cyan + "  TABLE STREAMING DEMO" + colors.reset);
    console.log(colors.cyan + "═".repeat(70) + colors.reset);
    console.log();
    var stateColor = state === "complete" ? colors.green : colors.yellow;
    console.log("  State: ".concat(stateColor).concat(state.toUpperCase()).concat(colors.reset));
    console.log("  Title: ".concat(data.title || colors.dim + "(loading...)" + colors.reset));
    console.log();
    // Table header
    console.log("  " + "─".repeat(66));
    console.log("  \u2502 ".concat("ID".padEnd(4), " \u2502 ").concat("Name".padEnd(15), " \u2502 ").concat("Email".padEnd(25), " \u2502 ").concat("Status".padEnd(10), " \u2502"));
    console.log("  " + "─".repeat(66));
    var _loop_1 = function (i) {
        var row = data.rows[i];
        var rowChanged = changedPaths.some(function (p) { return p.startsWith("rows[".concat(i, "]")); });
        var highlight = rowChanged ? colors.bgGreen : "";
        var id = String(row.id || 0).padEnd(4);
        var name_1 = (row.name || colors.dim + "..." + colors.reset).toString().padEnd(15);
        var email = (row.email || colors.dim + "..." + colors.reset).toString().padEnd(25);
        var status_1 = (row.status || colors.dim + "..." + colors.reset).toString().padEnd(10);
        console.log("  \u2502 ".concat(highlight).concat(id).concat(colors.reset, " \u2502 ").concat(name_1, " \u2502 ").concat(email, " \u2502 ").concat(status_1, " \u2502"));
    };
    // Table rows
    for (var i = 0; i < data.rows.length; i++) {
        _loop_1(i);
    }
    console.log("  " + "─".repeat(66));
    console.log();
    console.log(colors.dim + "  Rows: ".concat(data.rows.length, " | Changed: ").concat(changedPaths.length, " paths") + colors.reset);
    console.log();
}
function demoForm() {
    return __awaiter(this, void 0, void 0, function () {
        var FormSchema, formData, _a, _b, _c, data, state, changedPaths, e_1_1;
        var _d, e_1, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    FormSchema = zod_1.z.object({
                        firstName: zod_1.z.string(),
                        lastName: zod_1.z.string(),
                        email: zod_1.z.string(),
                        age: zod_1.z.number(),
                        isVerified: zod_1.z.boolean(),
                        bio: zod_1.z.string(),
                    });
                    formData = {
                        firstName: "Alexander",
                        lastName: "Thompson",
                        email: "alex.thompson@example.com",
                        age: 32,
                        isVerified: true,
                        bio: "Senior software engineer with expertise in distributed systems.",
                    };
                    console.log("\n🎬 Starting Form Demo...\n");
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                case 1:
                    _g.sent();
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 8, 9, 14]);
                    _a = true, _b = __asyncValues((0, stream_1.createStableStream)({
                        schema: FormSchema,
                        source: simulateLLMStream(JSON.stringify(formData), 10, 80),
                    }));
                    _g.label = 3;
                case 3: return [4 /*yield*/, _b.next()];
                case 4:
                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 7];
                    _f = _c.value;
                    _a = false;
                    data = _f.data, state = _f.state, changedPaths = _f.changedPaths;
                    renderForm(data, state, changedPaths);
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 100); })];
                case 5:
                    _g.sent();
                    _g.label = 6;
                case 6:
                    _a = true;
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 14];
                case 8:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 14];
                case 9:
                    _g.trys.push([9, , 12, 13]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 11];
                    return [4 /*yield*/, _e.call(_b)];
                case 10:
                    _g.sent();
                    _g.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14:
                    console.log(colors.green + "  ✓ Form complete!" + colors.reset);
                    console.log();
                    return [2 /*return*/];
            }
        });
    });
}
function demoTable() {
    return __awaiter(this, void 0, void 0, function () {
        var TableSchema, tableData, _a, _b, _c, data, state, changedPaths, e_2_1;
        var _d, e_2, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    TableSchema = zod_1.z.object({
                        title: zod_1.z.string(),
                        rows: zod_1.z.array(zod_1.z.object({
                            id: zod_1.z.number(),
                            name: zod_1.z.string(),
                            email: zod_1.z.string(),
                            status: zod_1.z.string(),
                        })).min(5), // Pre-fill with 5 skeleton rows
                    });
                    tableData = {
                        title: "Team Members",
                        rows: [
                            { id: 1, name: "Alice Chen", email: "alice@company.com", status: "active" },
                            { id: 2, name: "Bob Smith", email: "bob@company.com", status: "active" },
                            { id: 3, name: "Carol White", email: "carol@company.com", status: "pending" },
                        ],
                    };
                    console.log("\n🎬 Starting Table Demo...\n");
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                case 1:
                    _g.sent();
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 8, 9, 14]);
                    _a = true, _b = __asyncValues((0, stream_1.createStableStream)({
                        schema: TableSchema,
                        source: simulateLLMStream(JSON.stringify(tableData), 12, 100),
                    }));
                    _g.label = 3;
                case 3: return [4 /*yield*/, _b.next()];
                case 4:
                    if (!(_c = _g.sent(), _d = _c.done, !_d)) return [3 /*break*/, 7];
                    _f = _c.value;
                    _a = false;
                    data = _f.data, state = _f.state, changedPaths = _f.changedPaths;
                    renderTable(data, state, changedPaths);
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 50); })];
                case 5:
                    _g.sent();
                    _g.label = 6;
                case 6:
                    _a = true;
                    return [3 /*break*/, 3];
                case 7: return [3 /*break*/, 14];
                case 8:
                    e_2_1 = _g.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 14];
                case 9:
                    _g.trys.push([9, , 12, 13]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 11];
                    return [4 /*yield*/, _e.call(_b)];
                case 10:
                    _g.sent();
                    _g.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14:
                    console.log(colors.green + "  ✓ Table complete! (trimmed from 5 skeleton rows to 3 actual)" + colors.reset);
                    console.log();
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\n" + "=".repeat(70));
                    console.log("  STABLE-STREAM VISUAL DEMO");
                    console.log("  Watch data fill in progressively as it streams");
                    console.log("=".repeat(70));
                    // Demo 1: Form
                    return [4 /*yield*/, demoForm()];
                case 1:
                    // Demo 1: Form
                    _a.sent();
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 2:
                    _a.sent();
                    // Demo 2: Table
                    return [4 /*yield*/, demoTable()];
                case 3:
                    // Demo 2: Table
                    _a.sent();
                    console.log("\n" + "=".repeat(70));
                    console.log("  Demo complete!");
                    console.log("=".repeat(70) + "\n");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
