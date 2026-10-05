import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLEAN, EXPECTED, MESSY, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');

test('examples: the messy inventory fails with the report that is saved in examples/output', async () => {
  const r = await run(MESSY);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('messy.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the clean inventory passes with the report that is saved', async () => {
  const r = await run(CLEAN);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('clean.txt'));
  assert.match(r.out, /\nfindings: 0\n/);
  assert.equal((await run([...CLEAN, '--fail-on', 'info'])).code, 0);
  assert.equal((await run([...CLEAN, '--config', 'examples/config.json', '--fail-on', 'info'])).code, 0, 'the clean inventory passes the configuration of the other example too');
});

test('examples: --explain, JSON, CSV, the GitHub commands and the defaults are the reports that are saved', async () => {
  assert.equal((await run([...MESSY, '--explain'])).out, await saved('messy-explain.txt'));
  assert.equal((await run([...MESSY, '--json', '--explain'])).out, await saved('messy.json'));
  assert.equal((await run([...MESSY, '--format', 'csv'])).out, await saved('messy-findings.csv'));
  assert.equal((await run([...MESSY, '--format', 'github'])).out, await saved('messy-github.txt'));
  assert.equal((await run(['--print-defaults'])).out, await saved('defaults.json'));
});

test('examples: the rules that fire on the messy inventory, each on the line built for it', async () => {
  const report = JSON.parse((await run([...MESSY, '--json'])).out);
  const flows = (await readFile(resolve(root, 'examples/messy/flows.csv'), 'utf8')).split('\n');
  const systems = (await readFile(resolve(root, 'examples/messy/systems.json'), 'utf8')).split('\n');
  // The line of the n-th flow with this id, and of the system with this name.
  const f = (id, n = 1) => `examples/messy/flows.csv:${flows.map((l, i) => [l.split(',')[0], i + 1]).filter(([x]) => x === id)[n - 1][1]}`;
  const s = (name) => `examples/messy/systems.json:${systems.findIndex((l) => l.includes(`"name": "${name}"`)) + 1}`;
  const byRule = {};
  for (const x of report.findings) (byRule[x.rule] ??= []).push(x.at);
  assert.deepEqual(byRule, {
    'unknown-location': [s('fleet-tracker'), f('F16')],
    'conflicting-writers': [f('F03'), f('F08')],
    'weak-authentication': [f('F03')],
    'retry-without-idempotency': [f('F03')],
    'missing-interval': [f('F05')],
    'no-encryption': [f('F05'), f('F07')],
    'personal-data-unencrypted': [f('F07')],
    'duplicate-flow': [f('F01', 2)],
    'unknown-pattern': [f('F14')],
    'unknown-system': [f('F16')],
    'location-conflict': [f('F17')],
    'unknown-value': [f('F17'), f('F18')],
    'invalid-record': [f('F19')],
    'api-key-over-internet': [f('F04')],
    'missing-monitoring': [f('F05')],
    'missing-error-handling': [f('F06')],
    'missing-owner': [f('F06')],
    'missing-retry': [f('F09')],
    'duplicate-id': [f('F01', 2)],
    'point-to-point-sprawl': [f('F01')]
  });
  assert.deepEqual(report.summary.systems.filter((x) => x.direct > 4).map((x) => x.system), ['order-hub']);
});

test('examples: the same files written with CRLF line ends give the same output', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'integration-flow-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const walk = async (sub) => {
      for (const e of await readdir(resolve(dir, sub), { withFileTypes: true })) {
        const rel = `${sub}/${e.name}`;
        if (e.isDirectory()) {
          if (e.name !== 'output') await walk(rel);
        } else if (!e.name.endsWith('.md')) {
          const text = (await readFile(resolve(dir, rel), 'utf8')).split('\r\n').join('\n');
          await writeFile(resolve(dir, rel), text.split('\n').join('\r\n'));
        }
      }
    };
    await walk('examples');
    assert.equal((await run([...MESSY, '--explain'], dir)).out, await saved('messy-explain.txt'));
    assert.equal((await run(CLEAN, dir)).out, await saved('clean.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
