import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_COLUMNS, CsvError, csvField, csvProblem, parseCsv, toCsv } from '../src/index.js';
import { checkOf, flowsCsv, reportOf } from './helpers.js';

// The CSV reader as RFC 4180 writes the format, every form closed and left open, and the CSV result list.

const values = (text) => parseCsv(text).map((r) => r.fields.map((f) => f.value));
const refused = (text) => {
  try {
    parseCsv(text);
  } catch (error) {
    assert.ok(error instanceof CsvError, error.message);
    return csvProblem(error, text).text;
  }
  return assert.fail('not refused');
};

test('csv: records end at CRLF, LF or a lone CR, the last line break is optional, and fields are separated by commas', () => {
  assert.deepEqual(values('a,b\r\nc,d\r\n'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(values('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(values('a,b\rc,d\r'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(values('a,,c,\n'), [['a', '', 'c', '']]);
  assert.deepEqual(values(''), []);
  assert.deepEqual(values('\n'), [['']]);
});

test('csv: a quoted field holds commas, line breaks and double quotes written twice; white space is kept', () => {
  assert.deepEqual(values('"a,b","line\none","say ""hi""", x \n'), [['a,b', 'line\none', 'say "hi"', ' x ']]);
  assert.deepEqual(values('"",""""\n'), [['', '"']]);
  assert.deepEqual(values('"a\r\nb",c\r\n'), [['a\r\nb', 'c']]);
});

test('csv: a byte order mark is skipped, and every field has its line and column', () => {
  const records = parseCsv(`${String.fromCharCode(0xfeff)}id,name\n"x\ny",z\nw,v\n`);
  assert.deepEqual(records[0].fields[0].value, 'id');
  assert.deepEqual(records.map((r) => [r.line, r.column]), [[1, 2], [2, 1], [4, 1]]);
  assert.deepEqual(records[1].fields.map((f) => [f.line, f.column]), [[2, 1], [3, 4]]);
});

test('csv: a quoted field that is not closed, a character after a closing quote and a stray quote are refused with their place', () => {
  assert.equal(refused('id\n"open,field\n'), 'line 2, column 1: a quoted field that is not closed; a field that starts with a double quote must end with one');
  assert.equal(refused('id,x\n"a"b,c\n'), 'line 2, column 4: a character after the closing double quote of a field; a double quote inside a quoted field is written twice');
  assert.equal(refused('id,x\nab"c,d\n'), 'line 2, column 3: a double quote inside a field that does not start with one; put the field in double quotes and write the quote twice');
  assert.equal(refused('"a" ,b'), 'line 1, column 4: a character after the closing double quote of a field; a double quote inside a quoted field is written twice');
});

test('csv: the limits of a field, a record and a file', () => {
  assert.throws(() => parseCsv(`${'x'.repeat(11)}\n`, { maxFieldLength: 10 }), /a field longer than 10 characters/);
  assert.throws(() => parseCsv(`"${'x'.repeat(11)}"\n`, { maxFieldLength: 10 }), /a field longer than 10 characters/);
  assert.throws(() => parseCsv(`"${'""'.repeat(11)}"\n`, { maxFieldLength: 10 }), /a field longer than 10 characters/);
  assert.throws(() => parseCsv(`${','.repeat(5)}\n`, { maxFields: 5 }), /a record with more than 5 fields/);
  assert.throws(() => parseCsv('a\nb\nc\n', { maxRecords: 2 }), /more than 2 records/);
  assert.equal(parseCsv('a\nb\n', { maxRecords: 2 }).length, 2);
});

test('csv field: quoted when it holds a comma, a quote or a line break, and a leading formula character neutralized', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "x"'), '"say ""x"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
  assert.equal(csvField('=1+2'), "'=1+2");
  assert.equal(csvField('+x'), "'+x");
  assert.equal(csvField('-x'), "'-x");
  assert.equal(csvField('@x'), "'@x");
  assert.equal(csvField('=a,b'), '"\'=a,b"');
  assert.equal(csvField(null), '');
  assert.equal(csvField(3), '3');
});

test('csv finding list: one record per finding in the order of the report, with CRLF line ends', () => {
  const r = checkOf([{ owner: '' }, { encryption: 'no' }]);
  const out = toCsv(r);
  assert.ok(out.endsWith('\r\n'));
  assert.ok(!out.replace(/\r\n/g, '').includes('\n'));
  const rows = out.trimEnd().split('\r\n');
  assert.equal(rows[0], CSV_COLUMNS.join(','));
  assert.equal(rows[0], 'level,rule,file,line,column,flow,source,target,found,fix');
  assert.equal(rows.length, 3);
  assert.match(rows[1], /^error,no-encryption,f\.csv,3,\d+,F2,app,erp,"the flow ""F2"" crosses from cloud to on-premise, a hybrid flow, and is not encrypted","encrypt the transport \(TLS, HTTPS, SFTP, a VPN\) and write it in the encryption column"$/);
  assert.equal(rows[2], `warning,missing-owner,f.csv,2,${r.findings[1].column},F1,app,erp,"the flow ""F1"" has no owner",name the team that answers for the flow and acts when it fails`);
});

test('csv finding list: a header only with no finding, and a name that starts with a formula character is written safely', () => {
  const empty = reportOf({ flows: { 'f.csv': flowsCsv({}) } });
  assert.equal(toCsv(empty), `${CSV_COLUMNS.join(',')}\r\n`);
  const rows = toCsv(checkOf([{ id: '=cmd', source: '@x,y', owner: '' }])).trimEnd().split('\r\n');
  assert.ok(rows[1].startsWith("warning,missing-owner,f.csv,2,"), rows[1]);
  assert.ok(rows[1].includes(`,'=cmd,"'@x,y",erp,`), rows[1]);
});
