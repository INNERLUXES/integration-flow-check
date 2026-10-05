// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// inventories to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const MESSY = ['examples/messy/flows.csv', '--systems', 'examples/messy/systems.json', '--config', 'examples/config.json'];
export const CLEAN = ['examples/clean/flows.json', '--systems', 'examples/clean/systems.csv'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the messy inventory: the counts, one finding of every rule that fires, the notes and the
// result.
export const EXPECTED = [
  'input: flows examples/messy/flows.csv (1 file: 1 CSV file; 19 records); systems examples/messy/systems.json (1 file: 1 JSON file; 12 records)',
  'config: examples/config.json (Brackenfold integration review): max direct connections 4; 1 location alias, 1 pattern alias; minimum severity info; fail on error',
  'flows: 18 flows: 8 hybrid, 11 crossing a boundary, 1 two-way, 10 real-time, 7 scheduled, 4 with personal data; 13 systems',
  'findings: 24 (17 error, 6 warning, 1 info)',
  '  order-hub       cloud       yes     7    2   3       5',
  'the system "fleet-tracker" has the location "private cloud", which is not cloud, on-premise or saas',
  'the flow "F03" is two-way between ledger-erp and crm-suite and names no data owner, so both can write customers',
  'the flow "F03" crosses from on-premise to saas, a hybrid flow, and authenticates with basic, a user name and a password',
  'the flow "F03" retries (3 tries) and names no idempotency key or method',
  'the flow "F05" is scheduled and names no interval',
  'the flow "F05" crosses from cloud to on-premise, a hybrid flow, and is not encrypted',
  'the flow "F07" carries personal data (employees) and states no transport encryption',
  'the flow "F08" writes employees from payroll into hr-suite, the flow at examples/messy/flows.csv:8 writes it from hr-suite into payroll, and the two do not name one data owner',
  'the flow "F01" moves orders from order-hub to warehouse-wms, as the flow at examples/messy/flows.csv:2 does',
  'the flow "F14" has the pattern "rest-ish", which is not one of api, event, file, batch, database or ipaas',
  'the flow "F16" names the target "order-hbu", which the systems file does not list, did you mean "order-hub"?',
  'the flow "F17" puts its source "data-lake" on-premise, and the systems file at examples/messy/systems.json:10 puts it in the cloud',
  'the flow "F17" has the authentication "magic link", which the tool does not know',
  'the flow "F18" has the trigger "whenever", which is not real-time or scheduled',
  'this row names no target system; the flow is not checked',
  'the flow "F04" runs from saas to cloud, over the internet, and authenticates with a static key (api-key)',
  'the flow "F05" is not monitored',
  'the flow "F06" has no error handling',
  'the flow "F06" has no owner',
  'the flow "F09" is real-time and names no retry policy',
  'the flow "F01" has the id of the flow at examples/messy/flows.csv:2',
  'the system "order-hub" is connected directly to 5 other systems',
  'note: examples/messy/systems.json: 1 key the tool does not read was left out: "company"',
  'note: examples/messy/flows.csv: 1 column the tool does not read was left out: "notes"',
  'does not certify that an integration is secure, correct or compliant',
  'RESULT: FAIL - 17 findings at or above error (17 error, 6 warning, 1 info)'
];
// Two on-premise systems that talk with no authentication and no encryption, the location alias head office, the
// pattern alias edi, the words hourly, nightly and daily and a cron expression as intervals, the event flows left out
// of the direct connections, a system whose location is reported once in the systems file, and the flows in good order
// are not reported as problems.
export const UNWANTED = ['RESULT: PASS', '"F06" crosses', '"F18" crosses', '"head office"', 'pattern "edi"', '"F02"', '"F11"', '"F12"', '"F13"', '"F15"', '"F08" crosses', 'interval "', 'ledger-erp" has the location'];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const messy = await run(MESSY);
  process.stdout.write(messy.out);
  expect('messy inventory', messy, 1, EXPECTED, UNWANTED);

  const clean = await run(CLEAN);
  expect('clean inventory', clean, 0, ['input: flows examples/clean/flows.json (1 file: 1 JSON file; 7 records); systems examples/clean/systems.csv (1 file: 1 CSV file; 6 records)', 'flows: 7 flows: 2 hybrid, 4 crossing a boundary, 0 two-way, 5 real-time, 2 scheduled, 6 with personal data; 6 systems', 'findings: 0', 'note: examples/clean/systems.csv: 1 column the tool does not read was left out: "notes"', 'RESULT: PASS - no finding at or above error'], ['  WARNING  ', '  ERROR  ', 'RESULT: FAIL']);

  // Without the configuration head office and edi are not known, and order-hub is under the default limit of five.
  expect('messy, built-in configuration', await run(MESSY.slice(0, 3)), 1, ['config: built-in defaults: max direct connections 5', 'has the location "head office", which is not cloud, on-premise or saas', 'has the pattern "edi"'], ['point-to-point-sprawl      examples']);
  // Only the errors are shown with --min-severity error.
  expect('messy, errors only', await run([...MESSY, '--min-severity', 'error']), 1, ['findings: 17 (17 error); 7 below error not shown', 'RESULT: FAIL - 17 findings at or above error'], ['WARNING  ', 'INFO     ']);
  // The clean inventory passes when every level fails the run.
  expect('clean, fail on info', await run([...CLEAN, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // With no systems file no system is checked against a list, and the flows, which leave the locations to the systems
  // file, name no location.
  expect('clean, no systems file', await run(['examples/clean/flows.json']), 1, ['systems none', 'the flow "T01" names no location for its source "patient-portal"', 'note: no systems file was given'], ['listed', 'ERROR    unknown-system']);
  // A file of no kind the tool reads stops the run.
  expect('messy, a README named', await run(['examples/messy/README.md']), 2, ['examples/messy/README.md: not a kind of file the tool reads'], [], 'err');

  // The README shows the whole report of the messy inventory, the --explain lines of one finding, the GitHub annotations
  // of two findings, the start of the CSV finding list and the report of the clean inventory.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  if (!readme.includes(messy.out)) problems.push('README: the sample output of the messy inventory differs from a real run');
  if (!readme.includes(clean.out)) problems.push('README: the sample output of the clean inventory differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/messy.txt'), messy.out);
  await writeFile(resolve(root, 'examples/output/clean.txt'), clean.out);
  const explain = await run([...MESSY, '--explain']);
  if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
  const lines = explain.out.split('\n');
  const at = lines.findIndex((l) => l.includes('retry-without-idempotency') && l.includes('flows.csv:4'));
  const sample = lines.slice(at, at + 8).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the --explain sample of the retry with no idempotency differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-explain.txt'), explain.out);
  const github = await run([...MESSY, '--format', 'github']);
  if (github.code !== 1) problems.push(`github: exit code ${github.code}, expected 1`);
  const picked = github.out.split('\n').filter((x) => x.includes('title=integration-flow-check weak-authentication::') || x.includes('title=integration-flow-check missing-retry::'));
  if (picked.length !== 2) problems.push('github: the sample lines are not in the output');
  for (const l of picked) if (!readme.includes(l)) problems.push('README: the GitHub sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-github.txt'), github.out);
  const csv = await run([...MESSY, '--format', 'csv']);
  if (csv.code !== 1) problems.push(`csv: exit code ${csv.code}, expected 1`);
  const head = csv.out.split('\r\n').slice(0, 4).join('\n');
  if (!readme.includes(head)) problems.push('README: the CSV sample differs from a real run');
  await writeFile(resolve(root, 'examples/output/messy-findings.csv'), csv.out);
  const json = await run([...MESSY, '--json', '--explain']);
  if (json.code !== 1) problems.push(`json: exit code ${json.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output/messy.json'), json.out);
  const defaults = await run(['--print-defaults']);
  if (defaults.code !== 0) problems.push(`--print-defaults: exit code ${defaults.code}, expected 0`);
  await writeFile(resolve(root, 'examples/output/defaults.json'), defaults.out);

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
