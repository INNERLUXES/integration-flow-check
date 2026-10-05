// Command line: integration-flow-check <flows>... [--systems <file>]... [--config <file>] [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkPaths } from './check.js';
import { defaultsAsConfig } from './config.js';
import { toCsv } from './csv.js';
import { LEVELS } from './data.js';
import { toGithub, toJson, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, json: toJson, csv: toCsv, github: toGithub };

export const USAGE = `Usage: integration-flow-check <flows>... [--systems <file>]... [--config <file>] [options]

Checks an inventory of integration flows between cloud, on-premise and SaaS systems. Reads CSV (RFC 4180) or JSON files
of flows, each with an id, a source and a target system and their locations, a pattern, a direction, the data and its
owner, a trigger, the authentication, the transport encryption, a retry policy, the idempotency, the error handling,
the monitoring, an owner and a personal data flag, and optionally files of the known systems with their locations. It
reports unknown systems, locations, patterns and values, duplicate flows, systems that write the same data into each
other with no single owner, hybrid flows with no encryption or weak authentication, static keys over the internet,
personal data with no encryption, retries with no idempotency, real-time flows with no retry, scheduled flows with no
interval, flows with no error handling, monitoring or owner, and systems connected directly to too many others, with a
summary per system and per pattern. It connects to no system, reads no clock, opens no network connection and writes
nothing to disk.

Options:
  --systems <file>          a CSV or JSON file of the known systems and their locations; give it more than once for
                            several files
  --config <file>           settings in strict JSON: rules, maxDirectConnections, locationAliases, patternAliases,
                            minSeverity and failOn (--print-defaults shows them)
  --format <name>           text, json, csv or github (default: text); csv writes one row per finding, github writes
                            workflow commands that GitHub shows as annotations
  --json                    the same as --format json
  --min-severity <level>    the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: minSeverity of
                            the configuration, else info)
  --fail-on <level>         the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: failOn of
                            the configuration, else error)
  --explain                 show the rule, the public sources and the tool's own choice behind each finding
  --print-defaults          print the built-in configuration and exit
  --help                    show this text
  --version                 show the version

Rules: ${RULES.map((r) => `${r.id} (${r.key === null ? 'always error' : `rules.${r.key}`})`).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);
export const MAX_INPUTS = 100;

export function parseArgs(argv) {
  const o = { flows: [], systems: [], config: null, format: null, json: false, minSeverity: null, failOn: null, explain: false, printDefaults: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  const named = (p) => o.flows.includes(p) || o.systems.includes(p);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--print-defaults') o.printDefaults = true;
    else if (a === '--config') o.config = once(a, o.config, next());
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '--systems') {
      const v = next();
      if (named(v)) throw new Error(`${v} is named twice`);
      o.systems.push(v);
    } else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else if (named(a)) throw new Error(`${a} is named twice`);
    else o.flows.push(a);
    if (o.flows.length + o.systems.length > MAX_INPUTS) throw new Error(`more than ${MAX_INPUTS} files; merge the flows or the systems into fewer files`);
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!o.help && !o.version && !o.printDefaults) {
    if (!o.flows.length) throw new Error('give the flows to check: one or more .csv or .json files, such as integration-flow-check flows.csv --systems systems.csv');
    for (const p of [...o.flows, ...o.systems, ...(o.config === null ? [] : [o.config])]) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, json, csv or github)`);
    for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
    if (o.explain && (o.format === 'github' || o.format === 'csv')) throw new Error(`--explain adds the sources of each finding to the text and JSON reports; the ${o.format} format has no place for them`);
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`integration-flow-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.printDefaults) {
    io.out(`${JSON.stringify(defaultsAsConfig(), null, 2)}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths({ flows: o.flows, systems: o.systems, config: o.config, minSeverity: o.minSeverity, failOn: o.failOn, version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`integration-flow-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`integration-flow-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
