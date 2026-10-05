// A run: read the configuration, the flows and the systems, run the checks, and build the report of the run. A path on
// the command line that cannot be used (missing, a link, a folder, a file of no kind the tool reads), a configuration
// with a problem, or input past the limit of a run stops the run with an InputError and no result. A file of the input
// that cannot be read, or that the readers refuse, is an error finding of its own, so the run fails at the default
// level and never passes because a part of the input was passed over.

import { ConfigError, defaultConfig, readConfig } from './config.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { FILE_LIMITS, inspectPath, readText, readTextFile } from './files.js';
import { FLOW_LIMITS, checkFlows } from './flows.js';
import { KINDS, fileKind } from './kinds.js';
import { RECORD_LIMITS, readRecords, unreadableFile } from './records.js';
import { RULES, atOrAbove, decide } from './rules.js';
import { grouped, listText, plural } from './size.js';
import { safeText } from './text.js';

export const LIMITS = { ...FILE_LIMITS, ...RECORD_LIMITS, ...FLOW_LIMITS, maxFindingsPerRule: 500 };
export const MAX_PROBLEMS = 20;

export class InputError extends Error {
  constructor(problems) {
    super(problems.join('; '));
    this.problems = problems;
  }
}

// A copy of a value with every text in it cleaned by safeText, for the parts of the report that come from the input.
export function cleanTexts(value) {
  if (typeof value === 'string') return safeText(value, 300);
  if (Array.isArray(value)) return value.map(cleanTexts);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanTexts(v)]));
  return value;
}

// A list of problems for an error message: the first twenty, then a count.
export function capped(problems) {
  return problems.length > MAX_PROBLEMS ? [...problems.slice(0, MAX_PROBLEMS), `and ${grouped(problems.length - MAX_PROBLEMS)} more`] : problems;
}

// The level of a rule under a configuration: the rules of input problems are always errors.
export function levelOf(rule, config) {
  return rule.key === null ? 'error' : config.rules[rule.key];
}

const filesOf = (files) => ({ paths: files.map((f) => safeText(f.file)), files: files.map((f) => ({ file: safeText(f.file), kind: f.kind, read: f.read, rows: f.rows, records: f.records.length })), byKind: Object.fromEntries(KINDS.map((k) => [k, files.filter((f) => f.kind === k).length])) });

// The run as a report object, from the files that were read and the configuration.
export function buildReport({ flows, systems, config, minSeverity, failOn, version, limits = LIMITS }) {
  const { summary, findings: checked, unsuggested } = checkFlows(flows, systems, config, limits);
  const files = [...systems, ...flows];
  const raw = [...files.flatMap((f) => f.problems.map((p) => ({ flow: '', source: '', target: '', ...p }))), ...checked];
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  const fileOrder = new Map(files.map((f, i) => [f.file, i]));
  const level = (id) => levelOf(RULES.find((r) => r.id === id), config);
  const order = (a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || fileOrder.get(a.file) - fileOrder.get(b.file) || a.line - b.line || a.column - b.column || ruleOrder.get(a.rule) - ruleOrder.get(b.rule);
  const all = raw.filter((f) => level(f.rule) !== 'off').map((f) => ({ ...f, level: level(f.rule) })).sort(order);
  const shown = all.filter((f) => atOrAbove(f.level, minSeverity));
  const hidden = all.length - shown.length;
  const perRule = new Map();
  const findings = [];
  let cut = 0;
  for (const f of shown) {
    const n = (perRule.get(f.rule) ?? 0) + 1;
    perRule.set(f.rule, n);
    if (n > limits.maxFindingsPerRule) cut += 1;
    else {
      const rule = RULES.find((r) => r.id === f.rule);
      const file = safeText(f.file);
      findings.push({
        rule: f.rule,
        level: f.level,
        file,
        line: f.line,
        column: f.column,
        at: `${file}:${f.line}`,
        flow: safeText(f.flow, 120),
        source: safeText(f.source, 120),
        target: safeText(f.target, 120),
        found: safeText(f.found, 600),
        fix: rule.fix,
        basis: rule.basis.map((k) => ({ text: POINTS[k].text, source: pointPage(k).title, url: pointPage(k).url })),
        own: rule.own
      });
    }
  }
  // The result counts every finding at or above the minimum severity, including the ones past the limit of a rule.
  const result = decide(shown, failOn);
  const notes = [];
  for (const f of files) if (f.ignored.length) notes.push(`${f.file}: ${plural(f.ignored.length, f.kind === 'csv' ? 'column' : 'key')} the tool does not read ${f.ignored.length === 1 ? 'was' : 'were'} left out: ${listText(f.ignored.map((x) => `"${x}"`), 6)}`);
  if (!systems.length) notes.push('no systems file was given, so no system is checked against a list; name one with --systems');
  if (unsuggested) notes.push(`${plural(unsuggested, 'unknown name')} got no suggestion of a near name, past the limit of ${grouped(limits.maxSuggestions)} suggestions`);
  if (cut) notes.push(`${plural(cut, 'finding')} past the limit of ${grouped(limits.maxFindingsPerRule)} per rule ${cut === 1 ? 'is' : 'are'} counted but not listed`);
  if (hidden) notes.push(`${plural(hidden, 'finding')} below ${minSeverity} ${hidden === 1 ? 'is' : 'are'} not shown`);
  const off = RULES.filter((r) => r.key !== null && levelOf(r, config) === 'off');
  if (off.length) notes.push(`${plural(off.length, 'rule')} ${off.length === 1 ? 'is' : 'are'} off: ${off.map((r) => r.id).join(', ')}`);
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.level] += 1;
  return {
    tool: 'integration-flow-check',
    version,
    input: { flows: filesOf(flows), systems: filesOf(systems) },
    config: {
      file: config.file === null ? null : safeText(config.file),
      name: config.name === null ? null : safeText(config.name, 120),
      maxDirectConnections: config.maxDirectConnections,
      locationAliases: cleanTexts(config.locationAliases),
      patternAliases: cleanTexts(config.patternAliases),
      minSeverity,
      failOn,
      rules: RULES.map((r) => ({ id: r.id, key: r.key, level: levelOf(r, config), rule: safeText(r.rule(config), 600) }))
    },
    summary: cleanTexts(summary),
    findings,
    totals: { findings: shown.length, byLevel, hidden, notListed: cut },
    result,
    notes: notes.map((n) => safeText(n, 600)),
    notice: NOTICE
  };
}

// Reads the files of one role, after their paths were checked: the files read, and the bytes read so far.
async function readAll(given, role, limits, total, problems) {
  const files = [];
  for (const g of given) {
    let read;
    try {
      read = await readText(g.full, g.shown, limits.maxFileBytes);
    } catch (error) {
      files.push(unreadableFile(g.shown, role, g.kind, 'unreadable-file', 1, 1, `the file cannot be read: ${error.reason ?? error.message}; nothing in it is checked`));
      continue;
    }
    total.bytes += read.size;
    if (total.bytes > limits.maxTotalBytes) {
      problems.push(`${g.shown}: the files read so far hold more than ${grouped(limits.maxTotalBytes)} bytes, the limit of one run`);
      break;
    }
    files.push(readRecords(read.text, g.shown, role, g.kind, limits));
  }
  return files;
}

// Reads the configuration, the flows and the systems named and checks them: the report object of the run.
export async function checkPaths({ flows, systems = [], config: configPath = null, minSeverity = null, failOn = null, version = '0.0.0', limits = LIMITS, base = process.cwd() }) {
  let config;
  try {
    if (configPath) {
      const c = await readTextFile(configPath, base, limits.maxConfigBytes);
      config = readConfig(c.text, c.file);
    } else config = defaultConfig();
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(capped(error.problems));
    throw new InputError([error.message]);
  }
  const problems = [];
  const seen = new Set();
  const given = { flows: [], systems: [] };
  for (const [role, paths] of [['flows', flows], ['systems', systems]]) {
    for (const path of paths) {
      let g;
      try {
        g = await inspectPath(path, base);
      } catch (error) {
        problems.push(error.message);
        continue;
      }
      const kind = fileKind(g.shown);
      if (kind === null) {
        problems.push(`${g.shown}: not a kind of file the tool reads (a name ending in .csv or .json)`);
        continue;
      }
      if (seen.has(g.full)) {
        problems.push(`${g.shown}: is named twice`);
        continue;
      }
      seen.add(g.full);
      given[role].push({ ...g, kind });
    }
  }
  if (problems.length) throw new InputError(capped(problems));
  const total = { bytes: 0 };
  const systemFiles = await readAll(given.systems, 'systems', limits, total, problems);
  const flowFiles = problems.length ? [] : await readAll(given.flows, 'flows', limits, total, problems);
  if (problems.length) throw new InputError(capped(problems));
  return buildReport({ flows: flowFiles, systems: systemFiles, config, minSeverity: minSeverity ?? config.minSeverity, failOn: failOn ?? config.failOn, version, limits });
}
