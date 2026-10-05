import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CsvError, FILE_LIMITS, JsonError, LIMITS, MAX_PROBLEMS, authenticationOf, errorHandlingOf, isInterval, locationOf, parseCsv, parseJson, patternOf, triggerOf } from '../src/index.js';
import { HEADER, SHEADER, cli, flowsCsv, reportOf, rulesOf, run, systemsCsv, systemsJson, withFiles } from './helpers.js';

// Hostile input: files built to exhaust the memory or the time, to make the tool follow a link, to rewrite the
// terminal, to start a second workflow command, to slip a formula into a spreadsheet or to change how objects behave.
// Each heavy test also checks the time, because work that grows faster than the input is a failure even when the
// answer is right. Tests that need a symbolic link, a device or file permissions are guarded with process.platform,
// and none of them asserts a line: lines are asserted in the tests that run everywhere.

const LIMIT = { timeout: 180000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};

const GOOD = { 'f.csv': flowsCsv({}), 's.csv': systemsCsv(['app', 'cloud'], ['erp', 'on-premise']) };

test('hostile: a file over its size limit is an error finding, a configuration over its limit stops the run', LIMIT, async () => {
  const big = await fast(() => run({ ...GOOD, 'big.csv': `${SHEADER}\n${' '.repeat(FILE_LIMITS.maxFileBytes)}` }, ['f.csv', '--systems', 's.csv', '--systems', 'big.csv']));
  assert.equal(big.code, 1);
  assert.match(big.out, /big\.csv:1\n {11}the file cannot be read: [\d,]+ bytes is over the 32 MB limit; nothing in it is checked/);
  const config = await run({ ...GOOD, 'c.json': ' '.repeat(FILE_LIMITS.maxConfigBytes + 1) }, ['f.csv', '--config', 'c.json']);
  assert.equal(config.code, 2);
  assert.match(config.err, /c\.json: [\d,]+ bytes is over the 1 MB limit/);
});

test('hostile: a hundred thousand flows between a thousand systems, each with every check to run, are checked in seconds', LIMIT, async () => {
  const n = 100000;
  const systems = Array.from({ length: 1000 }, (_, i) => [`s${i}`, i % 2 ? 'cloud' : 'on-premise']);
  const flows = Array.from({ length: n }, (_, i) => ({ id: `F${i % 50000}`, source: `s${i % 1000}`, target: `s${(i * 7 + 1) % 1000}`, sourceLocation: '', targetLocation: '', data: `d${i % 30000}`, encryption: 'no', idempotency: '', owner: '', dataOwner: i % 3 ? 's0' : '', direction: i % 5 ? 'one-way' : 'two-way' }));
  const r = await fast(() => reportOf({ flows: { 'f.csv': flowsCsv(...flows) }, systems: { 's.csv': systemsCsv(...systems) } }), 60000);
  assert.equal(r.summary.totals.flows, n);
  assert.equal(r.summary.systems.length, 1000);
  assert.ok(r.findings.length >= LIMITS.maxFindingsPerRule * 4);
  assert.ok(r.findings.every((f, i, all) => all.filter((g) => g.rule === f.rule).length <= LIMITS.maxFindingsPerRule));
  assert.ok(r.totals.findings > n);
});

test('hostile: many names the tool does not know get a limited number of suggestions, and each rule lists at most its limit', LIMIT, async () => {
  const rows = Array.from({ length: 3000 }, (_, i) => ({ pattern: `pattern-${i}`, owner: '' }));
  const r = await fast(() => reportOf({ flows: { 'f.csv': flowsCsv(...rows) } }), 20000);
  assert.equal(r.findings.filter((f) => f.rule === 'unknown-pattern').length, LIMITS.maxFindingsPerRule);
  assert.ok(r.notes.some((x) => /findings past the limit of 500 per rule are counted but not listed/.test(x)));
  assert.ok(r.notes.some((x) => /2,900 unknown names got no suggestion of a near name, past the limit of 100 suggestions/.test(x)));
});

test('hostile: long values for the patterns of locations, triggers, intervals and authentications are read in one pass', LIMIT, async () => {
  const long = (s) => s.repeat(Math.floor(60000 / s.length));
  for (const text of [long('9'), long('9 '), `every ${long('1')} min`, long('* '), long('1/'), long('a'), `scheduled ${long('x ')}`, long('+'), long('dlq+')]) {
    await fast(() => {
      isInterval(text);
      triggerOf(text);
      locationOf(text);
      patternOf(text);
      authenticationOf(text);
      errorHandlingOf(text);
    });
  }
  const r = await fast(() => reportOf({ flows: { 'f.csv': flowsCsv({ targetLocation: long('on premise '), pattern: long('x'), trigger: `scheduled ${long('9')}`, authentication: long('key ') }) } }));
  assert.deepEqual(rulesOf(r).sort(), ['missing-interval', 'unknown-location', 'unknown-pattern', 'unknown-value']);
});

test('hostile: long runs of quotes, commas, line breaks, brackets and escapes are read or refused in one pass', LIMIT, async () => {
  for (const text of ['"'.repeat(500001), `"${'""'.repeat(30000)}"`, ','.repeat(999), '\n'.repeat(500000), '\r'.repeat(500000), `a${'"'.repeat(500000)}`, `"a"${'x'.repeat(500000)}`]) {
    await fast(() => {
      try {
        parseCsv(text);
      } catch (error) {
        assert.ok(error instanceof CsvError, error.message);
      }
    });
  }
  for (const text of ['['.repeat(500000), `[${'1,'.repeat(200000)}1]`, `"${'\\"'.repeat(200000)}"`, `{${'"a":1,'.repeat(10)}`, '{"a":'.repeat(100000)]) {
    await fast(() => {
      try {
        parseJson(text, { maxValues: 5000000, maxStringLength: 1000000 });
      } catch (error) {
        assert.ok(error instanceof JsonError, error.message);
      }
    });
  }
});

test('hostile: a set of a hundred files of no kind the tool reads lists twenty problems and a count', LIMIT, async () => {
  const files = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`f${String(i).padStart(3, '0')}.txt`, 'x']));
  const r = await fast(() => run(files, Object.keys(files)));
  assert.equal(r.code, 2);
  assert.match(r.err, /the input has problems:/);
  assert.match(r.err, /\n {2}and 80 more\n$/);
  assert.equal(r.err.split('\n').filter((l) => l.startsWith('  f')).length, MAX_PROBLEMS);
});

test('hostile: CRLF, CR and a byte order mark give the same report as LF', async () => {
  const files = {
    'f.csv': `${HEADER}\nF1,app,erp,cloud,on-premise,api,,"orders\nand returns",app,real-time,,basic,no,3,,dead-letter,yes,,yes\n`,
    's.json': '{\n  "systems": [\n    {"name": "app", "location": "cloud"},\n    {"name": "erp", "location": "on-premise"}\n  ]\n}\n'
  };
  const lf = await run(files, ['f.csv', '--systems', 's.json', '--json']);
  assert.equal(lf.code, 1, lf.err);
  assert.equal(JSON.parse(lf.out).totals.findings, 5);
  for (const eol of ['\r\n', '\r']) {
    const changed = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, `${String.fromCharCode(0xfeff)}${v.split('\n').join(eol)}`]));
    const r = await run(changed, ['f.csv', '--systems', 's.json', '--json']);
    assert.equal(r.out, lf.out, JSON.stringify(eol));
  }
});

test('hostile: control, escape and direction characters in file names and values never reach the reports', async () => {
  const esc = String.fromCharCode(27);
  const rlo = String.fromCharCode(0x202e);
  const ls = String.fromCharCode(0x2028);
  const name = `p${rlo}.csv`;
  const files = { [name]: `${HEADER}\nF${esc}[2J,ap${rlo}p,er${ls}p,clo${esc}ud,on-premise,api,,orders,app,real-time,,oauth2,no,3,id,dead-letter,yes,te${rlo}am,no\n`, 's.csv': systemsCsv([`ap${rlo}p`, 'cloud']) };
  for (const format of ['text', 'json', 'csv', 'github']) {
    const r = await run(files, [name, '--systems', 's.csv', '--format', format, ...(format === 'text' || format === 'json' ? ['--explain'] : [])]);
    assert.equal(r.code, 1, r.err);
    for (const c of [esc, rlo, ls]) assert.ok(!r.out.includes(c) && !r.err.includes(c), `${format}: ${c.charCodeAt(0)}`);
  }
  const bad = await run({ [`bad${rlo}.txt`]: 'x' }, [`bad${rlo}.txt`]);
  assert.equal(bad.code, 2);
  assert.ok(!bad.err.includes(rlo));
});

test('hostile: a text cannot start a second workflow command', async () => {
  const r = await run({ 'f.csv': `${HEADER}\n"%0A::error::x","a\n::error file=x::y",erp,cloud,on-premise,api,,d,a,real-time,,oauth2,tls,3,id,dlq,yes,,no\n` }, ['f.csv', '--format', 'github']);
  const lines = r.out.trimEnd().split('\n');
  assert.ok(lines.every((l) => l.startsWith('::error ') || l.startsWith('::warning ') || l.startsWith('::notice ') || l.startsWith('integration-flow-check: ')), r.out);
  assert.ok(r.out.includes('%250A::error::x'));
  assert.equal(lines.length, 2, 'one finding and the summary line');
});

test('hostile: a value that starts with a formula character is not a formula in the CSV finding list', async () => {
  const r = await run({ 'f.csv': `${HEADER}\n"=HYPERLINK(""x"")",+app,@erp,cloud,on-premise,api,,-d,a,real-time,,oauth2,tls,3,id,dlq,yes,,no\n` }, ['f.csv', '--format', 'csv']);
  assert.equal(r.code, 0, r.err);
  const row = r.out.split('\r\n')[1];
  assert.ok(row.startsWith(`warning,missing-owner,f.csv,2,`), row);
  assert.ok(row.includes(`,"'=HYPERLINK(""x"")",'+app,'@erp,`), row);
});

test('hostile: constructor, toString and __proto__ as values, columns, keys and aliases are only data', async () => {
  const r = reportOf({
    flows: { 'a.csv': 'source,__proto__,target,constructor,pattern,auth,direction\n__proto__,x,toString,y,valueOf,constructor,hasOwnProperty\n' },
    systems: { 'b.json': systemsJson({ name: 'constructor', location: '__proto__' }) }
  }, { rules: { missingErrorHandling: 'off', missingMonitoring: 'off', missingOwner: 'off' } });
  assert.deepEqual(rulesOf(r).sort(), ['unknown-location', 'unknown-location', 'unknown-location', 'unknown-pattern', 'unknown-system', 'unknown-system', 'unknown-value', 'unknown-value']);
  assert.equal(Object.getPrototypeOf({}), Object.prototype);
  assert.equal({}.x, undefined);
  const cfg = await run({ ...GOOD, 'c.json': '{"rules": {"toString": "off"}, "locationAliases": {"__proto__": "x"}, "patternAliases": {"constructor": "valueOf"}}' }, ['f.csv', '--config', 'c.json']);
  assert.equal(cfg.code, 2);
  assert.match(cfg.err, /"toString" is not a key of rules/);
  assert.match(cfg.err, /locationAliases\.__proto__ must be one of cloud, on-premise, saas/);
  assert.match(cfg.err, /patternAliases\.constructor must be one of api, event/);
});

test('hostile: empty files of both kinds are reported as files the readers refuse, without a crash', async () => {
  const r = await run({ 'a.csv': '', 'b.json': '', 'c.csv': '\n\n' }, ['a.csv', 'b.json', '--systems', 'c.csv']);
  assert.equal(r.code, 1, r.err);
  assert.match(r.out, /input: flows a\.csv, b\.json \(2 files: 1 CSV file, 1 JSON file; 0 records\); systems c\.csv \(1 file: 1 CSV file; 0 records\)/);
  assert.match(r.out, /the file is empty; a header line that names the source, target columns was expected/);
  assert.match(r.out, /line 1, column 1: the text ends where a value was expected; nothing in the file is read/);
  assert.match(r.out, /the header line of a systems file names no name or location column \(it names ""\)/);
});

test('hostile: a file named through a symbolic link is refused, and so is a configuration', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows needs extra rights to make a symbolic link');
    return;
  }
  await withFiles({ 'real/f.csv': flowsCsv({}), 'c.json': '{}' }, async (dir) => {
    await symlink(resolve(dir, 'real/f.csv'), resolve(dir, 'linked.csv'));
    await symlink(resolve(dir, 'c.json'), resolve(dir, 'c-link.json'));
    await mkdir(resolve(dir, 'via'));
    await symlink(resolve(dir, 'real'), resolve(dir, 'via/dir'));
    const r = await cli(['linked.csv'], dir);
    assert.equal(r.code, 2);
    assert.match(r.err, /linked\.csv: is a symbolic link, which is not followed/);
    const s = await cli(['real/f.csv', '--systems', 'linked.csv'], dir);
    assert.equal(s.code, 2);
    assert.match(s.err, /linked\.csv: is a symbolic link/);
    const c = await cli(['real/f.csv', '--config', 'c-link.json'], dir);
    assert.equal(c.code, 2);
    assert.match(c.err, /c-link\.json: is a symbolic link/);
    const d = await cli(['via/dir'], dir);
    assert.equal(d.code, 2);
    assert.match(d.err, /is a symbolic link, which is not followed/);
  });
});

test('hostile: a device named as flows, systems or the configuration is refused', LIMIT, async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows has no /dev/zero to name as an input');
    return;
  }
  await withFiles(GOOD, async (dir) => {
    const config = await fast(() => cli(['f.csv', '--config', '/dev/zero'], dir));
    assert.equal(config.code, 2);
    assert.match(config.err, /is not a regular file/);
    const input = await fast(() => cli(['/dev/zero'], dir));
    assert.equal(input.code, 2);
    assert.match(input.err, /is not a regular file|not a kind of file/);
    const listed = await fast(() => cli(['f.csv', '--systems', '/dev/zero'], dir));
    assert.equal(listed.code, 2);
  });
});

test('hostile: a file without read access is an error finding, and the rest is still checked', async (t) => {
  if (process.platform === 'win32') {
    t.skip('Windows does not take away read access with chmod');
    return;
  }
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('the root user can read a file without read access');
    return;
  }
  await withFiles({ ...GOOD, 'n.csv': systemsCsv(['x', 'cloud']) }, async (dir) => {
    await chmod(resolve(dir, 'n.csv'), 0o000);
    try {
      const r = await cli(['f.csv', '--systems', 'n.csv', '--systems', 's.csv'], dir);
      assert.equal(r.code, 1);
      assert.match(r.out, /the file cannot be read: cannot be read \(EACCES\)/);
      assert.match(r.out, /flows: 1 flow: 1 hybrid/);
    } finally {
      await chmod(resolve(dir, 'n.csv'), 0o644);
    }
  });
});
