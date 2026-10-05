import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { KIND_NAMES, NOTICE, USAGE, VERSION, escapeData, escapeProperty, parseArgs, toGithub, toJson, toText } from '../src/index.js';
import { HEADER, checkOf, cli, columnOf, flowsCsv, flowsJson, lineOf, reportOf, run, systemsCsv, systemsJson, withFiles } from './helpers.js';

const SYSTEMS = systemsCsv(['app', 'cloud'], ['erp', 'on-premise']);
const CLEAN = { 'f.csv': flowsCsv({}, { source: 'erp', target: 'app', sourceLocation: '', targetLocation: '', pattern: 'event', data: 'stock' }), 's.csv': SYSTEMS };
const WARN = { ...CLEAN, 'f.csv': flowsCsv({ owner: '' }) };
const ERROR = { ...CLEAN, 'f.csv': flowsCsv({ encryption: 'no' }) };
const BROKEN = { 'f.csv': 'source,target\n"open\n', 's.csv': SYSTEMS };
const ARGS = ['f.csv', '--systems', 's.csv'];

test('cli: exit 0 below the fail-on level, 1 at or above it, from the flag or the configuration', async () => {
  const clean = await run(CLEAN, ARGS);
  assert.equal(clean.code, 0, clean.err);
  assert.match(clean.out, /^integration-flow-check: flows f\.csv; systems s\.csv\ninput: flows f\.csv \(1 file: 1 CSV file; 2 records\); systems s\.csv \(1 file: 1 CSV file; 2 records\)\nconfig: built-in defaults: max direct connections 5; 0 location aliases, 0 pattern aliases; minimum severity info; fail on error\nrules: unknown-system \(error\); /);
  assert.match(clean.out, /\nflows: 2 flows: 2 hybrid, 2 crossing a boundary, 0 two-way, 2 real-time, 0 scheduled, 0 with personal data; 2 systems\nfindings: 0\n/);
  assert.match(clean.out, /RESULT: PASS - no finding at or above error\n$/);
  assert.equal(clean.err, '');
  const warn = await run(WARN, ARGS);
  assert.equal(warn.code, 0, 'a warning does not fail the run by default');
  assert.equal((await run(WARN, [...ARGS, '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(CLEAN, [...ARGS, '--fail-on', 'info'])).code, 0, 'nothing at all to report');
  const configured = await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [...ARGS, '--config', 'c.json']);
  assert.equal(configured.code, 1);
  assert.match(configured.out, /RESULT: FAIL - 1 finding at or above warning \(1 warning\)\n$/);
  assert.equal((await run({ ...WARN, 'c.json': '{"failOn": "warning"}' }, [...ARGS, '--config', 'c.json', '--fail-on', 'error'])).code, 0, 'the flag wins over the configuration');
  const error = await run(ERROR, ARGS);
  assert.equal(error.code, 1);
  assert.match(error.out, /RESULT: FAIL - 1 finding at or above error \(1 error\)\n$/);
  const broken = await run(BROKEN, ARGS);
  assert.equal(broken.code, 1, 'a file that cannot be parsed fails the run at the default level');
  assert.match(broken.out, /ERROR {4}unparsable-file +f\.csv:2\n {11}line 2, column 1: a quoted field that is not closed; a field that starts with a double quote must end with one; nothing in the file is read/);
});

test('cli: --min-severity hides the findings below it and a note counts them', async () => {
  const r = await run(WARN, [...ARGS, '--min-severity', 'error']);
  assert.equal(r.code, 0);
  assert.match(r.out, /findings: 0; 1 below error not shown/);
  assert.match(r.out, /note: 1 finding below error is not shown/);
});

test('cli: several flows and systems files, CSV and JSON, are read together', async () => {
  const files = { 'a.csv': flowsCsv({}), 'b.json': flowsJson({ id: 'F9', source: 'crm', target: 'app', pattern: 'api', data: 'leads', dataOwner: 'crm', trigger: 'hourly', auth: 'oauth2', encryption: 'tls', retry: 'none', errorHandling: 'alert', monitoring: true, owner: 'sales' }), 's1.csv': SYSTEMS, 's2.json': systemsJson({ name: 'crm', location: 'saas' }) };
  const r = await run(files, ['a.csv', 'b.json', '--systems', 's1.csv', '--systems', 's2.json', '--json']);
  assert.equal(r.code, 0, r.err);
  const out = JSON.parse(r.out);
  assert.deepEqual(out.input.flows.paths, ['a.csv', 'b.json']);
  assert.deepEqual(out.input.systems.files, [{ file: 's1.csv', kind: 'csv', read: true, rows: 2, records: 2 }, { file: 's2.json', kind: 'json', read: true, rows: 1, records: 1 }]);
  assert.deepEqual(out.input.flows.byKind, { csv: 1, json: 1 });
  assert.deepEqual(out.summary.systems.map((s) => [s.system, s.location, s.out, s.in]), [['app', 'cloud', 1, 1], ['erp', 'on-premise', 0, 1], ['crm', 'saas', 1, 0]]);
  assert.equal(out.findings.length, 0);
});

test('cli: with no systems file a note says so, and the flows give their own locations', async () => {
  const r = await run({ 'f.csv': flowsCsv({}) }, ['f.csv']);
  assert.equal(r.code, 0);
  assert.match(r.out, /input: flows f\.csv \(1 file: 1 CSV file; 1 record\); systems none\n/);
  assert.match(r.out, /note: no systems file was given, so no system is checked against a list; name one with --systems\n/);
  assert.ok(r.out.includes('\n  system  location    out  in  hybrid  direct\n'), 'no listed column without a systems file');
});

test('cli: exit 2 for usage errors, with the usage and nothing on standard output', async () => {
  for (const [args, message] of [
    [[], /give the flows to check: one or more \.csv or \.json files/],
    [['--systems', 's.csv'], /give the flows to check/],
    [['f.csv', 'f.csv'], /f\.csv is named twice/],
    [['f.csv', '--systems', 'f.csv'], /f\.csv is named twice/],
    [['f.csv', '--bogus'], /unknown argument --bogus/],
    [['f.csv', '--format', 'xml'], /unknown format xml \(text, json, csv or github\)/],
    [['f.csv', '--format', 'json', '--format', 'text'], /--format was given twice/],
    [['f.csv', '--json', '--format', 'csv'], /--json and --format csv ask for two formats; give one/],
    [['f.csv', '--min-severity', 'notice'], /--min-severity: unknown level notice \(info, warning, error\)/],
    [['f.csv', '--fail-on', 'fatal'], /--fail-on: unknown level fatal/],
    [['f.csv', '--fail-on', 'error', '--fail-on', 'info'], /--fail-on was given twice/],
    [['f.csv', '--config'], /--config needs a value/],
    [['f.csv', '--systems'], /--systems needs a value/],
    [['f.csv', '--config', '--json'], /--config needs a value/],
    [['f.csv', '--explain', '--format', 'github'], /--explain adds the sources of each finding to the text and JSON reports; the github format has no place for them/],
    [['f.csv', '--explain', '--format', 'csv'], /the csv format has no place for them/],
    [['-'], /reading from standard input is not supported/],
    [['f.csv', '--systems', '-'], /reading from standard input is not supported/],
    [['https://example.com/f.csv'], /give a local path; the tool never fetches a URL/],
    [['f.csv', '--systems', 'file://s.csv'], /give a local path/]
  ]) {
    const r = await run(CLEAN, args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.err, message, args.join(' '));
    assert.ok(r.err.includes('Usage: integration-flow-check'), args.join(' '));
    assert.equal(r.out, '');
  }
  assert.throws(() => parseArgs(Array.from({ length: 101 }, (_, i) => `p${i}.csv`)), /more than 100 files/);
  assert.throws(() => parseArgs(['f.csv', ...Array.from({ length: 100 }, (_, i) => ['--systems', `s${i}.csv`]).flat()]), /more than 100 files/);
});

test('cli: exit 2 for input errors, with the problems and no result', async () => {
  for (const [files, args, message] of [
    [CLEAN, ['missing.csv'], /missing\.csv: no such file/],
    [CLEAN, ['f.csv', '--systems', 'gone.json'], /gone\.json: no such file/],
    [{ ...CLEAN, 'dir/x.csv': 'source\n' }, ['dir'], /dir: is a folder; give the file itself/],
    [{ 'f.txt': 'source\n' }, ['f.txt'], /f\.txt: not a kind of file the tool reads \(a name ending in \.csv or \.json\)/],
    [{ '.csv': 'source\n' }, ['.csv'], /\.csv: not a kind of file the tool reads/],
    [CLEAN, ['f.csv', './f.csv'], /f\.csv: is named twice/],
    [CLEAN, ['f.csv', '--systems', './f.csv'], /f\.csv: is named twice/],
    [{ ...CLEAN, 'c.json': '{"failOm": "info"}' }, ['f.csv', '--config', 'c.json'], /c\.json: line 1: "failOm" is not a key of the configuration; did you mean "failOn"\?/],
    [CLEAN, ['f.csv', '--config', 'nope.json'], /nope\.json: no such file/],
    [{ ...CLEAN, 'd/c.json': '{}' }, ['f.csv', '--config', 'd'], /d: is a folder; give the file itself/]
  ]) {
    const r = await run(files, args);
    assert.equal(r.code, 2, `${args.join(' ')}: ${r.err}`);
    assert.match(r.err, /^integration-flow-check: no result, the input has (?:a problem|problems):\n/);
    assert.match(r.err, message);
    assert.equal(r.out, '');
  }
});

test('cli: a binary, UTF-16 or invalid UTF-8 file, or one over its limit, is an error finding, and the rest is still read', async () => {
  const r = await run({ ...WARN, 'j.csv': Buffer.from([0x66, 0, 0x64]), 'k.json': Buffer.from([0xff, 0xfe, 0x5b, 0]), 'l.csv': Buffer.from([0x66, 0x64, 0xe9, 0x0a]) }, ['f.csv', 'j.csv', '--systems', 'k.json', '--systems', 'l.csv', '--systems', 's.csv']);
  assert.equal(r.code, 1);
  assert.match(r.out, /j\.csv:1\n {11}the file cannot be read: holds binary data \(a null byte\); only text is read; export the sheet as CSV; nothing in it is checked/);
  assert.match(r.out, /the file cannot be read: is UTF-16; only UTF-8 is read/);
  assert.match(r.out, /the file cannot be read: is not valid UTF-8; only UTF-8 text is read/);
  assert.match(r.out, /the flow "F1" has no owner/);
  const big = await run(CLEAN, ARGS, { maxFileBytes: 10 });
  assert.match(big.out, /f\.csv:1\n {11}the file cannot be read: \d+ bytes is over the 10 byte limit/);
  const one = CLEAN['f.csv'].length;
  const total = await run({ 'x.csv': CLEAN['f.csv'], 'y.csv': CLEAN['f.csv'] }, ['x.csv', 'y.csv'], { maxTotalBytes: one });
  assert.equal(total.code, 2);
  assert.match(total.err, /y\.csv: the files read so far hold more than [\d,]+ bytes, the limit of one run/);
  const listed = await run({ 'x.csv': CLEAN['f.csv'], 'y.csv': SYSTEMS }, ['x.csv', '--systems', 'y.csv'], { maxTotalBytes: SYSTEMS.length });
  assert.equal(listed.code, 2, 'the systems count toward the limit of a run');
});

test('cli: --help, --version and --print-defaults', async () => {
  const help = await cli(['--help'], '.');
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const s of ['--systems', '--fail-on', '--min-severity', '--format', 'github', 'csv', 'missing-owner (rules.missingOwner)', 'unparsable-file (always error)', 'cloud, on-premise and SaaS', 'Exit codes: 0 no finding at or above the fail-on level']) assert.ok(USAGE.includes(s), s);
  const version = await cli(['--version'], '.');
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const defaults = await cli(['--print-defaults'], '.');
  assert.equal(defaults.code, 0);
  assert.deepEqual(Object.keys(JSON.parse(defaults.out)), ['name', 'rules', 'maxDirectConnections', 'locationAliases', 'patternAliases', 'minSeverity', 'failOn']);
});

test('text: the systems, the patterns, the findings with the fix, and --explain', () => {
  const r = checkOf([{ encryption: 'no' }, { source: 'erp', target: 'crm', sourceLocation: 'on-premise', targetLocation: 'saas', pattern: 'evnt', owner: '' }], [['app', 'cloud'], ['erp', 'on-premise'], ['crm', 'saas']]);
  const out = toText(r);
  assert.ok(out.includes('Systems (3)\n\n  system  location    listed  out  in  hybrid  direct\n  app     cloud       yes     1    0   1       1\n  erp     on-premise  yes     1    1   2       1\n  crm     saas        yes     0    1   1       0\n\n'));
  assert.ok(out.includes('Patterns (7)\n\n  pattern   hub  flows  hybrid  two-way\n  api       no   1      1       0\n'));
  assert.ok(out.includes('  unknown   no   1      1       0\n\n'));
  assert.match(out, /\n {2}ERROR {4}no-encryption {14}f\.csv:2\n {11}the flow "F1" crosses from cloud to on-premise, a hybrid flow, and is not encrypted\n {11}fix: encrypt the transport/);
  assert.ok(out.includes(NOTICE));
  assert.ok(!out.includes('basis:'));
  const explained = toText(r, { explain: true });
  assert.match(explained, /\n {11}rule: a hybrid flow, or a flow with a SaaS end, whose transport encryption is no or not stated\n {11}basis: a hybrid cloud is two or more distinct cloud infrastructures .+ \(NIST SP 800-145, The NIST Definition of Cloud Computing, full text \(NIST\), https:\/\/nvlpubs\.nist\.gov\/.+\)\n/);
  assert.match(explained, /the tool's own choice: a flow crosses a boundary when one end is on-premise/);
  const empty = toText(reportOf({ flows: { 'x.csv': 'source,target\n' } }));
  assert.ok(empty.includes('Systems (0)\n\n  none\n'));
  assert.ok(empty.includes('Findings (0)\n\n  none\n'));
  assert.ok(empty.includes('flows: 0 flows: 0 hybrid, 0 crossing a boundary, 0 two-way, 0 real-time, 0 scheduled, 0 with personal data; 0 systems\n'));
  assert.deepEqual(KIND_NAMES.json, ['JSON file', 'JSON files']);
});

test('json: the whole report, without the sources unless --explain', () => {
  const r = checkOf([{ owner: '' }]);
  const out = JSON.parse(toJson(r));
  assert.deepEqual(Object.keys(out), ['tool', 'version', 'input', 'config', 'summary', 'findings', 'totals', 'result', 'notes', 'notice']);
  assert.deepEqual(Object.keys(out.findings[0]), ['rule', 'level', 'file', 'line', 'column', 'at', 'flow', 'source', 'target', 'found', 'fix']);
  assert.deepEqual(Object.keys(out.summary), ['systems', 'patterns', 'totals']);
  assert.deepEqual(out.summary.systems[0], { system: 'app', location: 'cloud', listed: false, out: 1, in: 0, hybrid: 1, direct: 1 });
  assert.ok(JSON.parse(toJson(r, { explain: true })).findings[0].basis.length > 0);
  assert.deepEqual(out.result, { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 1, info: 0 }, text: 'PASS - no finding at or above error (1 warning)' });
  assert.equal(out.tool, 'integration-flow-check');
});

test('github: one workflow command per finding, with its properties and message escaped, then a summary line', () => {
  const line = 'F1,"100%\n::error",erp,cloud,on-premise,api,,d,app,real-time,,oauth2,no,3,id,dlq,yes,team,no';
  const text = `${HEADER}\n${line}\n`;
  const r = reportOf({ flows: { 'a,b:c.csv': text } });
  const lines = toGithub(r).trimEnd().split('\n');
  assert.equal(lines.length, 2, 'the line break in the source starts no command');
  assert.equal(lines[0], `::error file=a%2Cb%3Ac.csv,line=${lineOf(text, ',no,3')},col=${columnOf(text, 'no,3')},title=integration-flow-check no-encryption::the flow "F1" crosses from cloud to on-premise, a hybrid flow, and is not encrypted; fix: encrypt the transport (TLS, HTTPS, SFTP, a VPN) and write it in the encryption column`);
  assert.equal(lines[1], 'integration-flow-check: 1 flow (1 hybrid), 2 systems, 1 finding; RESULT: FAIL - 1 finding at or above error (1 error)');
  const many = Array.from({ length: 6 }, (_, i) => ({ source: 'hub', target: `s${i}`, sourceLocation: 'cloud', targetLocation: 'cloud' }));
  assert.match(toGithub(checkOf(many)), /^::notice file=f\.csv,line=2,col=\d+,title=integration-flow-check point-to-point-sprawl::/);
  assert.match(toGithub(checkOf([{ owner: '' }])), /^::warning file=f\.csv,line=2,col=\d+,title=integration-flow-check missing-owner::/);
  assert.equal(escapeData('a%\r\nb'), 'a%25%0D%0Ab');
  assert.equal(escapeProperty('a:b,c'), 'a%3Ab%2Cc');
});

test('cli: a run writes nothing to disk', async () => {
  await withFiles(WARN, async (dir) => {
    const before = await readdir(resolve(dir), { recursive: true });
    for (const format of ['text', 'json', 'csv', 'github']) assert.equal((await cli([...ARGS, '--format', format], dir)).code, 0);
    assert.deepEqual(await readdir(resolve(dir), { recursive: true }), before);
  });
});
