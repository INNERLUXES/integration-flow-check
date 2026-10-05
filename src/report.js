// The reports: text for a terminal, JSON for other tools, and GitHub workflow commands that turn each finding into an
// annotation on the file, line and column. The CSV finding list is in src/csv.js. Every text from the input (a file
// name, a system, an id or any other value) was cleaned by safeText before it reached the report object. The GitHub
// commands also escape the characters a command gives a meaning to, so a text in the input cannot end a command early
// or start another one.

import { KINDS } from './kinds.js';
import { grouped, plural } from './size.js';
import { safeText } from './text.js';

const clean = (t, max = 200) => safeText(t, max);

// The kinds of files as the report names them, one and many.
export const KIND_NAMES = { csv: ['CSV file', 'CSV files'], json: ['JSON file', 'JSON files'] };

const pathsText = (r) => [`flows ${r.input.flows.paths.join(', ')}`, ...(r.input.systems.paths.length ? [`systems ${r.input.systems.paths.join(', ')}`] : [])].join('; ');

function filesLine(part) {
  const n = part.byKind;
  const kinds = KINDS.filter((k) => n[k]).map((k) => `${grouped(n[k])} ${KIND_NAMES[k][n[k] === 1 ? 0 : 1]}`).join(', ');
  const rows = part.files.reduce((a, f) => a + f.rows, 0);
  return `${part.paths.join(', ')} (${plural(part.files.length, 'file')}${kinds ? `: ${kinds}` : ''}; ${plural(rows, 'record')})`;
}

const inputLine = (r) => `flows ${filesLine(r.input.flows)}; systems ${r.input.systems.files.length ? filesLine(r.input.systems) : 'none'}`;

function configLine(r) {
  const c = r.config;
  const where = c.file ? `${c.file}${c.name ? ` (${clean(c.name, 120)})` : ''}` : 'built-in defaults';
  const count = (o) => Object.keys(o).length;
  return `${where}: max direct connections ${grouped(c.maxDirectConnections)}; ${plural(count(c.locationAliases), 'location alias', 'location aliases')}, ${plural(count(c.patternAliases), 'pattern alias', 'pattern aliases')}; minimum severity ${c.minSeverity}; fail on ${c.failOn}`;
}

const rulesLine = (r) => r.config.rules.map((x) => `${x.id} (${x.level})`).join('; ');

function flowsLine(r) {
  const t = r.summary.totals;
  return `${plural(t.flows, 'flow')}: ${grouped(t.hybrid)} hybrid, ${grouped(t.crossing)} crossing a boundary, ${grouped(t.twoWay)} two-way, ${grouped(t.realTime)} real-time, ${grouped(t.scheduled)} scheduled, ${grouped(t.personalData)} with personal data; ${plural(t.systems, 'system')}`;
}

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// A table with a header row and its columns padded to the widest cell.
function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const cell = (t, max = 40) => (t === '' || t === null || t === undefined ? '-' : clean(t, max));

function systemLines(r) {
  if (!r.summary.systems.length) return ['  none', ''];
  const listed = r.input.systems.files.length > 0;
  const head = ['system', 'location', ...(listed ? ['listed'] : []), 'out', 'in', 'hybrid', 'direct'];
  const rows = r.summary.systems.map((s) => [cell(s.system), cell(s.location), ...(listed ? [s.listed ? 'yes' : 'no'] : []), grouped(s.out), grouped(s.in), grouped(s.hybrid), grouped(s.direct)]);
  return [...table(head, rows), ''];
}

function patternLines(r) {
  const rows = r.summary.patterns.map((p) => [p.pattern, p.hub ? 'yes' : 'no', grouped(p.flows), grouped(p.hybrid), grouped(p.twoWay)]);
  return [...table(['pattern', 'hub', 'flows', 'hybrid', 'two-way'], rows), ''];
}

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`integration-flow-check: ${pathsText(r)}`);
  out.push(`input: ${inputLine(r)}`);
  out.push(`config: ${configLine(r)}`);
  out.push(`rules: ${rulesLine(r)}`);
  out.push(`flows: ${flowsLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Systems (${grouped(r.summary.systems.length)})`, '');
  out.push(...systemLines(r));
  out.push(`Patterns (${grouped(r.summary.patterns.length)})`, '');
  out.push(...patternLines(r));
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...r.config.rules.map((x) => x.id.length));
  const pad = ' '.repeat(11);
  for (const f of r.findings) {
    out.push(`  ${f.level.toUpperCase().padEnd(8)} ${f.rule.padEnd(width)}  ${f.at}`);
    out.push(`${pad}${f.found}`);
    out.push(`${pad}fix: ${f.fix}`);
    if (explain) {
      out.push(`${pad}rule: ${r.config.rules.find((x) => x.id === f.rule).rule}`);
      for (const b of f.basis) out.push(`${pad}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${pad}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

// The message of a workflow command: %, CR and LF escaped.
export const escapeData = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// A property of a workflow command: also : and , escaped.
export const escapeProperty = (t) => escapeData(t).replace(/:/g, '%3A').replace(/,/g, '%2C');

const COMMANDS = { error: 'error', warning: 'warning', info: 'notice' };

export function toGithub(r) {
  const out = [];
  for (const f of r.findings) {
    const props = [`file=${escapeProperty(f.file)}`, `line=${f.line}`, ...(f.column ? [`col=${f.column}`] : []), `title=${escapeProperty(`integration-flow-check ${f.rule}`)}`];
    out.push(`::${COMMANDS[f.level]} ${props.join(',')}::${escapeData(`${f.found}; fix: ${f.fix}`)}`);
  }
  const t = r.summary.totals;
  out.push(`integration-flow-check: ${plural(t.flows, 'flow')} (${grouped(t.hybrid)} hybrid), ${plural(t.systems, 'system')}, ${grouped(r.totals.findings)} ${r.totals.findings === 1 ? 'finding' : 'findings'}; RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}
