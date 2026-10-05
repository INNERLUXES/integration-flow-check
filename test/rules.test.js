import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, atOrAbove, checkFlows, decide, defaultConfig, ruleById } from '../src/index.js';
import { checkOf, findingsOf, flowsCsv, reportOf, rulesOf, sortedRules, systemsCsv } from './helpers.js';

// Every rule with the form that is reported and the form next to it that is not. Each test changes only the fields
// of the good flow it is about (test/helpers.js).

const SYSTEMS = [['app', 'cloud'], ['erp', 'on-premise']];
const found = (r, rule) => findingsOf(r, rule).map((f) => f.found);

test('the good flow gives no finding, with or without a systems file', () => {
  const r = checkOf([{}]);
  assert.deepEqual(rulesOf(r), []);
  assert.deepEqual(r.summary.totals, { flows: 1, hybrid: 1, crossing: 1, twoWay: 0, realTime: 1, scheduled: 0, personalData: 0, systems: 2 });
  assert.deepEqual(rulesOf(checkOf([{ sourceLocation: '', targetLocation: '' }], SYSTEMS)), []);
});

test('unknown-system: a source, target or data owner the systems file does not list, with a near name', () => {
  const r = checkOf([{ target: 'erq', dataOwner: 'crm' }], SYSTEMS);
  assert.deepEqual(found(r, 'unknown-system'), ['the flow "F1" names the target "erq", which the systems file does not list, did you mean "erp"?', 'the flow "F1" names the data owner "crm", which the systems file does not list']);
  assert.equal(findingsOf(r, 'unknown-system')[0].level, 'error');
  assert.equal(findingsOf(checkOf([{ source: ' App ', target: 'ERP' }], SYSTEMS), 'unknown-system').length, 0, 'names compared in their term form');
  assert.equal(findingsOf(checkOf([{ target: 'erq' }]), 'unknown-system').length, 0, 'no systems file, no list');
  assert.equal(findingsOf(checkOf([{ dataOwner: '' }], SYSTEMS), 'unknown-system').length, 0, 'an empty data owner is not a system');
});

test('unknown-system: a systems file that cannot be read does not make every system unknown', () => {
  const r = reportOf({ flows: { 'f.csv': flowsCsv({}) }, systems: { 's.csv': 'name,location\n"open\n' } });
  assert.deepEqual(sortedRules(r), ['unparsable-file']);
});

test('unknown-location: an empty location with no systems entry, a name the tool does not know, and a system of the systems file', () => {
  const r = checkOf([{ sourceLocation: '', targetLocation: 'on-prem1se' }]);
  assert.deepEqual(found(r, 'unknown-location'), ['the flow "F1" names no location for its source "app"', 'the flow "F1" has the target location "on-prem1se", which is not cloud, on-premise or saas, did you mean "on-premise"?']);
  assert.equal(r.summary.totals.hybrid, 0, 'a flow with an end whose location is not known is not hybrid');
  const listed = checkOf([{ source: 'x', sourceLocation: '' }], [...SYSTEMS, ['x', 'private cloud'], ['y', '']]);
  assert.deepEqual(found(listed, 'unknown-location'), ['the system "x" has the location "private cloud", which is not cloud, on-premise or saas', 'the system "y" names no location'], 'reported at the systems file, not again at the flow');
  assert.match(found(checkOf([{ source: 'z', sourceLocation: '' }], SYSTEMS), 'unknown-location')[0], /names no location for its source "z", and the systems file does not list it$/);
  for (const ok of ['On-Prem', 'on premises', 'DATA CENTER', 'SaaS', 'software as a service', 'IaaS']) assert.equal(findingsOf(checkOf([{ targetLocation: ok }]), 'unknown-location').length, 0, ok);
});

test('unknown-location: a location alias of the configuration is read', () => {
  assert.equal(findingsOf(checkOf([{ targetLocation: 'head office' }]), 'unknown-location').length, 1);
  const r = checkOf([{ targetLocation: 'head office' }], null, { locationAliases: { 'Head Office': 'on-premise' } });
  assert.deepEqual(rulesOf(r), []);
  assert.equal(r.summary.totals.hybrid, 1);
});

test('location-conflict: a flow that places a system elsewhere than the systems file or an earlier flow', () => {
  const r = checkOf([{ targetLocation: 'cloud' }], SYSTEMS);
  assert.deepEqual(found(r, 'location-conflict'), ['the flow "F1" puts its target "erp" in the cloud, and the systems file at s.csv:3 puts it on-premise']);
  assert.equal(r.summary.totals.hybrid, 0, 'the location the flow gives is used for that flow');
  const flows = checkOf([{}, { source: 'erp', target: 'app', sourceLocation: 'saas', targetLocation: 'cloud' }]);
  assert.deepEqual(found(flows, 'location-conflict'), ['the flow "F2" puts its source "erp" in a SaaS application, and the flow at f.csv:2 puts it on-premise']);
  assert.equal(checkOf([{}, { source: 'erp', target: 'app', sourceLocation: 'on-prem', targetLocation: 'cloud' }]).findings.length, 0, 'two names of one location');
});

test('unknown-pattern: an empty pattern or one the tool does not know, with a near name; aliases are read', () => {
  const r = checkOf([{ pattern: '' }, { pattern: 'evnt' }, { pattern: 'magic' }]);
  assert.deepEqual(found(r, 'unknown-pattern'), ['the flow "F1" names no pattern', 'the flow "F2" has the pattern "evnt", which is not one of api, event, file, batch, database or ipaas, did you mean "event"?', 'the flow "F3" has the pattern "magic", which is not one of api, event, file, batch, database or ipaas']);
  assert.deepEqual(r.summary.patterns.at(-1), { pattern: 'unknown', hub: false, flows: 3, hybrid: 3, twoWay: 0 });
  for (const ok of ['REST', 'pub/sub', 'SFTP', 'ETL', 'CDC', 'ESB', 'iPaaS', 'webhook']) assert.equal(checkOf([{ pattern: ok }]).findings.length, 0, ok);
  assert.equal(checkOf([{ pattern: 'edi' }], null, { patternAliases: { edi: 'file' } }).findings.length, 0);
});

test('unknown-value: a direction, trigger, authentication, encryption, error handling, monitoring or flag the tool does not read', () => {
  const r = checkOf([{ direction: 'sideways', trigger: 'whenever', authentication: 'magic link', encryption: 'maybe', errorHandling: 'dead-letter + shrug', monitoring: 'sometimes', personalData: 'perhaps' }]);
  assert.deepEqual(found(r, 'unknown-value'), [
    'the flow "F1" has the direction "sideways", which is not one-way or two-way',
    'the flow "F1" has the trigger "whenever", which is not real-time or scheduled',
    'the flow "F1" has the authentication "magic link", which the tool does not know',
    'the flow "F1" has the encryption "maybe", which is not yes, no or a transport the tool knows',
    'the flow "F1" has the error handling "shrug", which is not dead-letter, alert or none',
    'the flow "F1" has the monitoring "sometimes", which is not yes or no',
    'the flow "F1" has the personal data flag "perhaps", which is not yes or no'
  ]);
  assert.deepEqual(sortedRules(r).filter((x) => x !== 'unknown-value'), [], 'the checks that need a value are not run on a value the tool does not read');
  assert.match(found(checkOf([{ authentication: 'oauht2' }]), 'unknown-value')[0], /did you mean "oauth2"\?$/);
});

test('duplicate-flow: the same source, target and data twice, and two-way flows in either order', () => {
  const r = checkOf([{ data: 'orders' }, { data: 'Orders' }, { data: 'invoices' }, { data: 'orders', target: 'crm' }]);
  assert.deepEqual(found(r, 'duplicate-flow'), ['the flow "F2" moves Orders from app to erp, as the flow at f.csv:2 does']);
  const two = checkOf([{ direction: 'two-way', data: 'customers' }, { direction: 'two-way', data: 'customers', source: 'erp', target: 'app', sourceLocation: 'on-premise', targetLocation: 'cloud' }]);
  assert.deepEqual(found(two, 'duplicate-flow'), ['the flow "F2" moves customers between erp and app, as the flow at f.csv:2 does']);
  assert.equal(findingsOf(checkOf([{ data: '' }, { data: '' }]), 'duplicate-flow').length, 0, 'a flow with no data is not compared');
  assert.equal(findingsOf(checkOf([{ data: 'x' }, { data: 'x', direction: 'two-way' }]), 'duplicate-flow').length, 0, 'a one-way and a two-way flow are not the same');
});

test('duplicate-id: the same id twice, compared in its term form; an empty id is not compared', () => {
  const r = checkOf([{ id: 'A-1' }, { id: 'a 1' }, { id: '' }, { id: '' }]);
  assert.deepEqual(findingsOf(r, 'duplicate-id').map((f) => [f.level, f.found]), [['warning', 'the flow "a 1" has the id of the flow at f.csv:2']]);
  assert.match(found(checkOf([{ id: '', owner: '' }]), 'missing-owner')[0], /^the flow from app to erp has no owner$/, 'a flow with no id is named by its ends');
});

test('conflicting-writers: a two-way flow with no data owner, and the near miss with one', () => {
  const r = checkOf([{ direction: 'two-way', dataOwner: '', data: 'customers' }]);
  assert.deepEqual(found(r, 'conflicting-writers'), ['the flow "F1" is two-way between app and erp and names no data owner, so both can write customers']);
  assert.equal(checkOf([{ direction: 'bidirectional', dataOwner: 'erp' }]).findings.length, 0);
  const noColumn = reportOf({ flows: { 'f.csv': 'source,target,direction\na,b,two-way\n' } }, { rules: { unknownLocation: 'off', unknownPattern: 'off', missingErrorHandling: 'off', missingMonitoring: 'off', missingOwner: 'off' } });
  assert.deepEqual(noColumn.findings.map((f) => [f.rule, f.column]), [['conflicting-writers', 5]], 'at the direction when there is no data owner column');
});

test('conflicting-writers: two flows that write the same data into each other with no single data owner', () => {
  const back = (dataOwner) => ({ source: 'erp', target: 'app', sourceLocation: 'on-premise', targetLocation: 'cloud', data: 'orders', dataOwner });
  const r = checkOf([{ data: 'orders', dataOwner: '' }, back('')]);
  assert.deepEqual(found(r, 'conflicting-writers'), ['the flow "F2" writes orders from erp into app, the flow at f.csv:2 writes it from app into erp, and neither names a data owner']);
  assert.match(found(checkOf([{ data: 'orders', dataOwner: 'app' }, back('erp')]), 'conflicting-writers')[0], /and the two do not name one data owner$/);
  assert.equal(checkOf([{ data: 'orders', dataOwner: 'app' }, back('App')]).findings.length, 0, 'one owner named by both');
  assert.equal(findingsOf(checkOf([{ data: 'orders' }, { ...back(''), data: 'invoices' }]), 'conflicting-writers').length, 0, 'other data');
});

test('no-encryption: a flow that crosses a boundary with no or no stated encryption; inside a site or one cloud it is not reported', () => {
  const r = checkOf([{ encryption: 'no' }, { encryption: '' }, { encryption: 'http', sourceLocation: 'saas', targetLocation: 'cloud' }]);
  assert.deepEqual(found(r, 'no-encryption'), [
    'the flow "F1" crosses from cloud to on-premise, a hybrid flow, and is not encrypted',
    'the flow "F2" crosses from cloud to on-premise, a hybrid flow, and states no transport encryption',
    'the flow "F3" runs from saas to cloud, over the internet, and is not encrypted'
  ]);
  for (const [s, t] of [['on-premise', 'on-premise'], ['cloud', 'cloud']]) assert.equal(checkOf([{ encryption: 'no', sourceLocation: s, targetLocation: t }]).findings.length, 0, `${s} to ${t}`);
  assert.equal(findingsOf(checkOf([{ encryption: 'no', sourceLocation: 'saas', targetLocation: 'saas' }]), 'no-encryption').length, 1, 'two SaaS applications talk over the internet');
  for (const ok of ['yes', 'TLS 1.3', 'https', 'SFTP', 'vpn', 'true']) assert.equal(checkOf([{ encryption: ok }]).findings.length, 0, ok);
});

test('weak-authentication: none, basic or no authentication stated on a flow that crosses a boundary', () => {
  const r = checkOf([{ authentication: 'none' }, { authentication: 'username password' }, { authentication: '' }]);
  assert.deepEqual(found(r, 'weak-authentication'), [
    'the flow "F1" crosses from cloud to on-premise, a hybrid flow, and has no authentication',
    'the flow "F2" crosses from cloud to on-premise, a hybrid flow, and authenticates with basic, a user name and a password',
    'the flow "F3" crosses from cloud to on-premise, a hybrid flow, and names no authentication'
  ]);
  assert.equal(checkOf([{ authentication: 'basic', sourceLocation: 'on-premise' }]).findings.length, 0, 'inside the site');
  for (const ok of ['OAuth 2.0', 'mutual TLS', 'managed identity', 'SAML', 'kerberos', 'ssh key', 'jwt']) assert.equal(checkOf([{ authentication: ok }]).findings.length, 0, ok);
});

test('api-key-over-internet: a static key on a flow that crosses a boundary is a warning', () => {
  const r = checkOf([{ authentication: 'API key' }, { authentication: 'sas' }]);
  assert.deepEqual(findingsOf(r, 'api-key-over-internet').map((f) => [f.level, f.found]), [['warning', 'the flow "F1" crosses from cloud to on-premise, a hybrid flow, and authenticates with a static key (api-key)'], ['warning', 'the flow "F2" crosses from cloud to on-premise, a hybrid flow, and authenticates with a static key (sas)']]);
  assert.equal(checkOf([{ authentication: 'api key', sourceLocation: 'cloud', targetLocation: 'cloud' }]).findings.length, 0, 'within the cloud');
});

test('personal-data-unencrypted: personal data with no encryption, wherever the flow runs', () => {
  const r = checkOf([{ personalData: 'yes', encryption: 'no', sourceLocation: 'on-premise', data: 'patients' }, { personalData: 'true', encryption: '', sourceLocation: 'on-premise' }]);
  assert.deepEqual(found(r, 'personal-data-unencrypted'), ['the flow "F1" carries personal data (patients) and is not encrypted', 'the flow "F2" carries personal data (data 2) and states no transport encryption']);
  assert.equal(checkOf([{ personalData: 'yes' }]).findings.length, 0, 'encrypted');
  assert.equal(checkOf([{ personalData: '', encryption: 'no', sourceLocation: 'on-premise' }]).findings.length, 0, 'an empty flag is no');
});

test('retry-without-idempotency: a retry with no idempotency key; none and no retry are not reported', () => {
  const r = checkOf([{ idempotency: '' }, { idempotency: 'none' }]);
  assert.deepEqual(found(r, 'retry-without-idempotency'), ['the flow "F1" retries (3 tries) and names no idempotency key or method, so a repeated delivery can write a record twice', 'the flow "F2" retries (3 tries) and names no idempotency key or method, so a repeated delivery can write a record twice']);
  assert.equal(checkOf([{ idempotency: '', retry: 'none', trigger: 'scheduled', interval: 'hourly' }]).findings.length, 0);
  assert.equal(checkOf([{ idempotency: 'upsert on order number' }]).findings.length, 0);
});

test('missing-retry: a real-time flow with no retry; a scheduled flow is not reported', () => {
  const r = checkOf([{ retry: '', idempotency: '' }, { retry: 'no', idempotency: '' }]);
  assert.deepEqual(findingsOf(r, 'missing-retry').map((f) => [f.level, f.found]), [['warning', 'the flow "F1" is real-time and names no retry policy'], ['warning', 'the flow "F2" is real-time and does not retry']]);
  assert.equal(checkOf([{ retry: '', trigger: 'scheduled', interval: 'every 15 min' }]).findings.length, 0);
  assert.equal(checkOf([{ retry: '', trigger: '' }]).findings.length, 0, 'no trigger stated');
});

test('missing-interval: a scheduled flow with no interval or one the tool does not read', () => {
  const r = checkOf([{ trigger: 'scheduled' }, { trigger: 'scheduled', interval: 'now and then' }, { trigger: 'cron' }]);
  assert.deepEqual(found(r, 'missing-interval'), ['the flow "F1" is scheduled and names no interval', 'the flow "F2" is scheduled with the interval "now and then", which the tool does not read', 'the flow "F3" is scheduled and names no interval']);
  for (const ok of [{ trigger: 'scheduled', interval: '15 min' }, { trigger: 'scheduled every 2 h' }, { trigger: 'hourly' }, { trigger: 'nightly' }, { trigger: '0 2 * * *' }, { trigger: '', interval: 'every 30 minutes' }, { trigger: 'cron 30 1 * * 1' }]) assert.equal(findingsOf(checkOf([ok]), 'missing-interval').length, 0, JSON.stringify(ok));
  const r2 = reportOf({ flows: { 'f.csv': 'source,target,trigger\na,b,scheduled\n' } }, { rules: { unknownLocation: 'off', unknownPattern: 'off', missingErrorHandling: 'off', missingMonitoring: 'off', missingOwner: 'off' } });
  assert.deepEqual(r2.findings.map((f) => [f.rule, f.column]), [['missing-interval', 5]], 'at the trigger when there is no interval column');
});

test('missing-error-handling, missing-monitoring and missing-owner: empty or none, and any other form counts', () => {
  const r = checkOf([{ errorHandling: '', monitoring: '', owner: '' }, { errorHandling: 'none', monitoring: 'no', owner: 'tbd' }]);
  assert.deepEqual(r.findings.map((f) => [f.rule, f.level, f.found]), [
    ['missing-error-handling', 'warning', 'the flow "F1" names no error handling'],
    ['missing-monitoring', 'warning', 'the flow "F1" does not say whether it is monitored'],
    ['missing-owner', 'warning', 'the flow "F1" has no owner'],
    ['missing-error-handling', 'warning', 'the flow "F2" has no error handling'],
    ['missing-monitoring', 'warning', 'the flow "F2" is not monitored'],
    ['missing-owner', 'warning', 'the flow "F2" has no owner']
  ]);
  assert.equal(checkOf([{ errorHandling: 'DLQ + alert', monitoring: 'dashboard', owner: 'x' }]).findings.length, 0);
  assert.equal(checkOf([{ errorHandling: 'none; alert' }]).findings.length, 0, 'none with another way still handles errors');
});

test('point-to-point-sprawl: a system connected directly to more than the limit; hub patterns are not counted', () => {
  const direct = Array.from({ length: 6 }, (_, i) => ({ source: 'hub', target: `s${i}`, sourceLocation: 'cloud', targetLocation: 'cloud' }));
  const r = checkOf(direct);
  assert.deepEqual(findingsOf(r, 'point-to-point-sprawl').map((f) => [f.level, f.found, f.at]), [['info', 'the system "hub" is connected directly to 6 other systems (s0, s1, s2, s3 and 2 more), more than 5; a hub such as an iPaaS or an event bus would connect it once', 'f.csv:2']]);
  assert.equal(checkOf(direct.slice(0, 5)).findings.length, 0, 'five is the limit');
  assert.equal(checkOf(direct.map((f, i) => (i ? f : { ...f, pattern: 'event' }))).findings.length, 0, 'an event flow is not a direct connection');
  assert.equal(checkOf([...direct.slice(0, 5), { ...direct[0], data: 'more', id: 'x' }]).findings.length, 0, 'a partner is counted once');
  assert.equal(findingsOf(checkOf(direct.slice(0, 3), null, { maxDirectConnections: 2 }), 'point-to-point-sprawl').length, 1);
  assert.deepEqual(r.summary.systems[0], { system: 'hub', location: 'cloud', listed: false, out: 6, in: 0, hybrid: 0, direct: 6 });
});

test('invalid-record: a system listed twice is not checked again', () => {
  const r = checkOf([{}], [...SYSTEMS, ['ERP', 'cloud']]);
  assert.deepEqual(findingsOf(r, 'invalid-record').map((f) => f.found), ['the system "ERP" is listed a second time; the first is at s.csv:3; the record is not checked']);
  assert.equal(findingsOf(r, 'location-conflict').length, 0, 'the second entry is not used');
});

test('the levels of the rules come from the configuration, and a rule set off reports nothing', () => {
  const r = checkOf([{ owner: '' }], null, { rules: { missingOwner: 'error' } });
  assert.deepEqual(r.findings.map((f) => f.level), ['error']);
  const off = checkOf([{ owner: '' }], null, { rules: { missingOwner: 'off' } });
  assert.equal(off.findings.length, 0);
  assert.ok(off.notes.includes('1 rule is off: missing-owner'));
  assert.equal(checkOf([{ owner: '' }], null, { rules: { missingOwner: 'error' } }).result.pass, false);
});

test('rules: atOrAbove and the result of a run', () => {
  assert.equal(atOrAbove('error', 'warning'), true);
  assert.equal(atOrAbove('info', 'warning'), false);
  assert.deepEqual(decide([], 'error'), { pass: true, failOn: 'error', failing: 0, byLevel: { error: 0, warning: 0, info: 0 }, text: 'PASS - no finding at or above error' });
  assert.equal(decide([{ level: 'warning' }, { level: 'info' }], 'warning').text, 'FAIL - 1 finding at or above warning (1 warning, 1 info)');
  assert.equal(ruleById('no-encryption').key, 'noEncryption');
  assert.deepEqual(RULES.filter((r) => r.key === null).map((r) => r.id), ['invalid-record', 'unreadable-file', 'unparsable-file']);
});

test('the findings are sorted by level, file, line, column and rule; the systems file comes first', () => {
  const r = reportOf({ flows: { 'b.csv': flowsCsv({ owner: '' }), 'a.csv': flowsCsv({ pattern: 'zz', id: 'Z', data: 'other' }) }, systems: { 's.csv': systemsCsv(['app', 'cloud'], ['erp', 'on-premise'], ['q', 'moon']) } });
  assert.deepEqual(r.findings.map((f) => [f.level, f.rule, f.file]), [['error', 'unknown-location', 's.csv'], ['error', 'unknown-pattern', 'a.csv'], ['warning', 'missing-owner', 'b.csv']]);
  assert.deepEqual(r.summary.systems.map((s) => s.system), ['app', 'erp', 'q']);
});

test('the summary: flows out and in, hybrid flows per system, and the six patterns in their order', () => {
  const r = checkOf([{}, { source: 'erp', target: 'crm', sourceLocation: 'on-premise', targetLocation: 'saas', pattern: 'event', direction: 'two-way', dataOwner: 'erp', personalData: 'yes' }]);
  assert.deepEqual(r.summary.systems.map((s) => [s.system, s.location, s.out, s.in, s.hybrid, s.direct]), [['app', 'cloud', 1, 0, 1, 1], ['erp', 'on-premise', 1, 1, 2, 1], ['crm', 'saas', 0, 1, 1, 0]]);
  assert.deepEqual(r.summary.patterns.map((p) => [p.pattern, p.flows, p.hybrid, p.twoWay]), [['api', 1, 1, 0], ['event', 1, 1, 1], ['file', 0, 0, 0], ['batch', 0, 0, 0], ['database', 0, 0, 0], ['ipaas', 0, 0, 0]]);
  assert.deepEqual(r.summary.totals, { flows: 2, hybrid: 2, crossing: 2, twoWay: 1, realTime: 2, scheduled: 0, personalData: 1, systems: 3 });
});

test('checkFlows: no flows gives an empty summary of the systems listed', () => {
  const out = checkFlows([], [], defaultConfig());
  assert.deepEqual(out.findings, []);
  assert.equal(out.summary.totals.flows, 0);
  assert.equal(out.summary.systems.length, 0);
});
