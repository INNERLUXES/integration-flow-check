// Shared test helpers: flows and systems built inline, checked in memory or written into a temporary folder that is
// removed after the test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux,
// macOS and Windows. The line a test expects is found with lineOf(), which counts lines the way the tool does, so a
// test never holds a line number worked out by hand for one system only. No test reads the clock, the time zone or
// the locale.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { ROLES, buildReport, defaultConfig, fileKind, lineStarts, main, positionOf, readConfig, readRecords } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'integration-flow-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function offsetOf(text, needle, n) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return at;
}

// The line (from 1) of the n-th place where needle starts in text.
export const lineOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).line;

// The column (from 1) of the n-th place where needle starts in text.
export const columnOf = (text, needle, n = 1) => positionOf(lineStarts(text), offsetOf(text, needle, n)).column;

// The configuration of a configuration object, through the real reader, or the defaults.
export const configOf = (object = null) => (object === null ? defaultConfig() : readConfig(JSON.stringify(object), 'config.json'));

// The header every flows file of the tests uses, one column per field in the order of ROLES.flows.fields.
export const HEADER = ROLES.flows.fields.join(',');

// The header every systems file of the tests uses.
export const SHEADER = 'name,location';

// A hybrid flow with nothing to report: every test changes only the fields it is about.
export const GOOD = { id: 'F1', source: 'app', target: 'erp', sourceLocation: 'cloud', targetLocation: 'on-premise', pattern: 'api', direction: 'one-way', data: 'orders', dataOwner: 'app', trigger: 'real-time', interval: '', authentication: 'oauth2', encryption: 'tls', retry: '3 tries', idempotency: 'order id', errorHandling: 'dead-letter', monitoring: 'yes', owner: 'team', personalData: 'no' };

// A field as RFC 4180 writes it, with no guard against formulas.
export const quote = (v) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// One CSV row of a flow: the good flow with its own id and data, and these fields changed.
export const row = (changes = {}, i = 0) => ROLES.flows.fields.map((f) => quote({ ...GOOD, id: `F${i + 1}`, data: `data ${i + 1}`, ...changes }[f])).join(',');

// A CSV flows file with the header and one row per object of changes; each flow has its own id and data unless a test
// sets them.
export const flowsCsv = (...records) => `${HEADER}\n${records.map((r, i) => row(r, i)).join('\n')}\n`;

// A CSV systems file of [name, location] pairs.
export const systemsCsv = (...systems) => `${SHEADER}\n${systems.map((s) => s.map(quote).join(',')).join('\n')}\n`;

// A JSON flows file of these records.
export const flowsJson = (...records) => `${JSON.stringify({ flows: records }, null, 2)}\n`;

// A JSON systems file of these records.
export const systemsJson = (...records) => `${JSON.stringify({ systems: records }, null, 2)}\n`;

// The report object of files checked in memory: objects of path to text for the flows and the systems, with a
// configuration object or none.
export function reportOf({ flows, systems = {} }, config = null, { minSeverity = 'info', failOn = 'error' } = {}) {
  const cfg = configOf(config);
  const read = (sources, role) => Object.entries(sources).map(([file, text]) => readRecords(text, file, role, fileKind(file)));
  return buildReport({ flows: read(flows, 'flows'), systems: read(systems, 'systems'), config: cfg, minSeverity, failOn, version: 'test' });
}

// The report object of one CSV flows file, each flow written as an object of changes to the good one, and a CSV
// systems file of [name, location] pairs when systems are given.
export const checkOf = (flows, systems = null, config = null, options = {}) => reportOf({ flows: { 'f.csv': flowsCsv(...flows) }, systems: systems === null ? {} : { 's.csv': systemsCsv(...systems) } }, config, options);

// The findings of a report, of one rule or of all.
export const findingsOf = (r, rule) => r.findings.filter((f) => !rule || f.rule === rule);

// The rule ids of the findings of a report, in order.
export const rulesOf = (r) => r.findings.map((f) => f.rule);

// The rule ids of the findings of a report, sorted.
export const sortedRules = (r) => rulesOf(r).sort();

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err, dir };
  });
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, dir) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
  return { code, out, err };
}
