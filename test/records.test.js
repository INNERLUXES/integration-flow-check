import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, fieldOf, readRecords, unreadableFile } from '../src/index.js';
import { HEADER, SHEADER, columnOf, flowsCsv, flowsJson, lineOf, systemsCsv, systemsJson } from './helpers.js';

// The two kinds of records: flows and systems, from CSV and JSON, with the names of their columns and keys, and the
// records and files that cannot be read.

const flows = (text, file = 'f.csv') => readRecords(text, file, 'flows', file.endsWith('.csv') ? 'csv' : 'json');
const systems = (text, file = 's.csv') => readRecords(text, file, 'systems', file.endsWith('.csv') ? 'csv' : 'json');

test('records: the columns of a flows file by name in any case and form, and of a systems file', () => {
  for (const [name, field] of [['ID', 'id'], ['Flow Name', 'id'], ['Source System', 'source'], ['from', 'source'], ['Target_System', 'target'], ['Destination', 'target'], ['source-location', 'sourceLocation'], ['Target Hosting', 'targetLocation'], ['Integration Pattern', 'pattern'], ['Data Object', 'data'], ['System of Record', 'dataOwner'], ['Schedule', 'trigger'], ['Run Every', 'interval'], ['Auth', 'authentication'], ['TLS', 'encryption'], ['Retry Policy', 'retry'], ['Idempotency Key', 'idempotency'], ['On Error', 'errorHandling'], ['Observability', 'monitoring'], ['Team', 'owner'], ['PII', 'personalData']]) assert.equal(fieldOf(name, 'flows'), field, name);
  for (const [name, field] of [['System', 'name'], ['Application', 'name'], ['Hosting', 'location'], ['LOCATION', 'location']]) assert.equal(fieldOf(name, 'systems'), field, name);
  for (const name of ['notes', 'location', '__proto__', 'toString', 'system']) assert.equal(fieldOf(name, 'flows'), null, name);
  for (const name of ['source', 'owner', 'constructor']) assert.equal(fieldOf(name, 'systems'), null, name);
  assert.deepEqual(ROLES.flows.columns, ['source', 'target']);
  assert.deepEqual(ROLES.systems.columns, ['name', 'location']);
});

test('records: a CSV flows file, every value trimmed, with the line and column of each field', () => {
  const text = `${HEADER}\n F1 , app , erp ,cloud,on-premise,api,,orders,app,real-time,,oauth2,tls,3,id,dead-letter,yes,team,no\n`;
  const r = flows(text);
  assert.equal(r.read, true);
  assert.equal(r.rows, 1);
  assert.deepEqual(r.problems, []);
  const f = r.records[0];
  assert.deepEqual([f.id, f.source, f.target, f.sourceLocation, f.direction, f.owner], ['F1', 'app', 'erp', 'cloud', '', 'team']);
  assert.deepEqual([f.line, f.at.target.line, f.at.target.column], [2, 2, columnOf(text, ' erp ')]);
});

test('records: columns in any order, columns the tool does not read named, and empty rows skipped', () => {
  const r = flows('Target,notes,Source,,Pattern\nerp,x,app,,api\n\n,,,,\n');
  assert.equal(r.records.length, 1);
  assert.deepEqual(r.ignored, ['notes', '(column 4, no name)']);
  assert.deepEqual([r.records[0].source, r.records[0].target, r.records[0].pattern, r.records[0].owner], ['app', 'erp', 'api', '']);
});

test('records: a CSV header without a column the role needs, or with a column named twice, is a file that cannot be read', () => {
  assert.match(flows('source,pattern\nx,api\n').problems[0].found, /^the header line of a flows file names no target column \(it names "source", "pattern"\); nothing in the file is read$/);
  assert.match(systems('name\nx\n').problems[0].found, /the header line of a systems file names no location column/);
  const header = 'source,target,from\n';
  const twice = flows(header);
  assert.equal(twice.problems[0].rule, 'unparsable-file');
  assert.match(twice.problems[0].found, /the header names the source twice, as "source" and "from"/);
  assert.equal(twice.problems[0].column, columnOf(header, 'from'));
  assert.match(flows('').problems[0].found, /the file is empty; a header line that names the source, target columns was expected/);
  assert.match(systems('').problems[0].found, /names the name, location columns was expected/);
});

test('records: a CSV row with the wrong number of fields, no source, no target or no name cannot be read', () => {
  const text = `${HEADER}\nF1,app\n${flowsCsv({ source: '' }).split('\n')[1]}\n${flowsCsv({ target: 'n/a' }).split('\n')[1]}\n${flowsCsv({}).split('\n')[1]}\n`;
  const r = flows(text);
  assert.equal(r.records.length, 1);
  assert.equal(r.rows, 4);
  assert.deepEqual(r.problems.map((p) => [p.rule, p.line, p.found]), [
    ['invalid-record', 2, `this row has 2 fields and the header has ${ROLES.flows.fields.length}; the row is not checked`],
    ['invalid-record', 3, 'this row names no source system; the flow is not checked'],
    ['invalid-record', 4, 'this row names no target system; the flow is not checked']
  ]);
  assert.match(systems(`${SHEADER}\n,cloud\n`).problems[0].found, /this row names no system name; the system is not checked/);
  assert.equal(systems(`${SHEADER}\nx,\n`).records.length, 1, 'a system with no location is read, and reported by its rule');
});

test('records: a quote that breaks CSV stops the reading of the file, with its place', () => {
  const r = flows(`${HEADER}\n"open,x\n`);
  assert.equal(r.read, false);
  assert.deepEqual([r.problems[0].rule, r.problems[0].line, r.problems[0].column], ['unparsable-file', 2, 1]);
  assert.match(r.problems[0].found, /a quoted field that is not closed; .*; nothing in the file is read$/);
});

test('records: a JSON list, or an object with a flows or systems list, keys matched like columns; true and false are yes and no', () => {
  const a = flows('[{"Source System": "app", "Target": "erp", "PII": true, "monitored": false, "retries": 3}]', 'f.json');
  assert.deepEqual([a.records[0].source, a.records[0].target, a.records[0].personalData, a.records[0].monitoring, a.records[0].retry], ['app', 'erp', 'yes', 'no', '3']);
  const b = flows(flowsJson({ source: 'a', target: 'b', notes: 'z' }), 'f.json');
  assert.deepEqual(b.ignored, ['notes']);
  const s = systems(systemsJson({ name: 'a', location: 'cloud' }, { system: 'b', hosting: 'saas' }), 's.json');
  assert.deepEqual(s.records.map((x) => [x.name, x.location]), [['a', 'cloud'], ['b', 'saas']]);
  const extra = systems('{"company": "x", "systems": []}', 's.json');
  assert.deepEqual(extra.ignored, ['company']);
  assert.equal(extra.rows, 0);
});

test('records: JSON that is not a list of records, or a record that is not an object, cannot be read', () => {
  assert.match(flows('{"records": []}', 'f.json').problems[0].found, /the file holds an object; a list of flows, or an object with a "flows" list, was expected/);
  assert.match(systems('{"flows": []}', 's.json').problems[0].found, /an object with a "systems" list, was expected/);
  assert.match(flows('"x"', 'f.json').problems[0].found, /the file holds a string/);
  const text = '{"flows": [1, null, ["a"], {"source": "x", "Source": "y"}, {"source": "a"}]}';
  const r = flows(text, 'f.json');
  assert.deepEqual(r.problems.map((p) => p.found), [
    'flows[0] is a number, not an object; the flow is not checked',
    'flows[1] is null, not an object; the flow is not checked',
    'flows[2] is a list, not an object; the flow is not checked',
    'flows[3] names the source twice, as "source" and "Source"; the flow is not checked',
    'flows[4] names no target system; the flow is not checked'
  ]);
  assert.deepEqual(r.problems.map((p) => p.column), [columnOf(text, '1,'), columnOf(text, 'null'), columnOf(text, '["a"]'), columnOf(text, '"y"'), columnOf(text, '{"source": "a"}')]);
});

test('records: a JSON value of the wrong kind is taken as empty, and a repeated name stops the reading of the file', () => {
  const r = flows('[{"source": "x", "target": "y", "owner": ["a"], "auth": {"b": 1}}]', 'f.json');
  assert.deepEqual(r.problems.map((p) => p.found), ['[0].owner is a list, not a text, a number or true or false; it is taken as empty', '[0].auth is an object, not a text, a number or true or false; it is taken as empty']);
  assert.deepEqual([r.records[0].owner, r.records[0].authentication], ['', '']);
  const repeated = '[{"source": "x", "source": "y"}]';
  const twice = flows(repeated, 'f.json');
  assert.equal(twice.problems[0].rule, 'unparsable-file');
  assert.ok(twice.problems[0].found.startsWith(`line 1, column ${columnOf(repeated, '"source": "y"')}: the name "source" appears twice in one object`));
  assert.match(systems('[{"name": "x",}]', 's.json').problems[0].found, /a comma before the closing brace/);
});

test('records: the limit of records in a file', () => {
  assert.equal(flows(flowsCsv({}, {}, {})).records.length, 3);
  const over = readRecords(flowsCsv({}, {}, {}), 'f.csv', 'flows', 'csv', { maxRecords: 2 });
  assert.equal(over.problems[0].rule, 'unparsable-file');
  assert.match(over.problems[0].found, /more than 2 records/);
  const overJson = readRecords(systemsJson({ name: 'a', location: 'cloud' }, { name: 'b', location: 'cloud' }), 's.json', 'systems', 'json', { maxRecords: 1 });
  assert.match(overJson.problems[0].found, /^more than 1 records; nothing in the file is read$/);
  assert.equal(lineOf(systemsCsv(['a', 'cloud']), 'a,'), 2);
  const u = unreadableFile('x.csv', 'flows', 'csv', 'unreadable-file', 1, 1, 'why');
  assert.deepEqual([u.read, u.records.length, u.problems[0].rule], [false, 0, 'unreadable-file']);
});
