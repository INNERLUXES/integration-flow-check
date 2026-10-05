import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTHENTICATIONS, AUTHENTICATION_NAMES, DIRECTIONS, ENCRYPTED, ERROR_HANDLING, ERROR_HANDLING_NAMES, INTERVAL_UNITS, INTERVAL_WORDS, LOCATIONS, LOCATION_NAMES, MONITORED, NO, NONE_WORDS, PATTERNS, PATTERN_NAMES, TRIGGERS, TRIGGER_NAMES, DIRECTION_NAMES, UNENCRYPTED, UNMONITORED, YES, authenticationOf, boundaryOf, crossingText, directionOf, encryptionOf, errorHandlingOf, isInterval, isNone, locationOf, monitoringOf, namesOf, patternOf, termForm, triggerOf, whereText, yesNo } from '../src/index.js';

// The words of a flow, read from their text: locations, patterns, directions, triggers and intervals,
// authentications, yes and no, error handling, and none, each with the form next to it that must not match.

test('vocabulary: the entries of each list, and no name used twice within a list', () => {
  assert.deepEqual(LOCATIONS.map((l) => l.name), ['cloud', 'on-premise', 'saas']);
  assert.deepEqual(PATTERNS.map((p) => [p.name, p.hub]), [['api', false], ['event', true], ['file', false], ['batch', false], ['database', false], ['ipaas', true]]);
  assert.deepEqual(DIRECTIONS.map((d) => d.name), ['one-way', 'two-way']);
  assert.deepEqual(TRIGGERS.map((t) => t.name), ['real-time', 'scheduled']);
  assert.deepEqual([...new Set(AUTHENTICATIONS.map((a) => a.strength))], ['strong', 'key', 'weak', 'none']);
  assert.deepEqual(ERROR_HANDLING.map((e) => e.name), ['dead-letter', 'alert', 'none']);
  for (const list of [LOCATIONS, PATTERNS, DIRECTIONS, TRIGGERS, AUTHENTICATIONS, ERROR_HANDLING]) {
    const all = list.flatMap((e) => [e.name, ...e.names].map(termForm));
    assert.equal(new Set(all).size, all.length, list[0].name);
    assert.equal(namesOf(list).size, all.length);
  }
  for (const [a, b] of [[YES, NO], [ENCRYPTED, UNENCRYPTED], [MONITORED, UNMONITORED]]) assert.deepEqual(a.filter((x) => b.includes(x)), []);
  assert.equal(LOCATION_NAMES.get('on premise').name, 'on-premise');
  assert.equal(PATTERN_NAMES.get('pub sub').name, 'event');
  assert.equal(DIRECTION_NAMES.get('bidirectional').name, 'two-way');
  assert.equal(TRIGGER_NAMES.get('cron').name, 'scheduled');
  assert.equal(AUTHENTICATION_NAMES.get('mutual tls').name, 'mtls');
  assert.equal(ERROR_HANDLING_NAMES.get('dlq').name, 'dead-letter');
});

test('locations: by name in any case and spacing, by an alias, and nothing near', () => {
  for (const [text, name] of [['Cloud', 'cloud'], ['ON-PREMISES', 'on-premise'], ['on_prem', 'on-premise'], ['Data Center', 'on-premise'], ['SaaS', 'saas'], ['Software as a Service', 'saas'], ['PaaS', 'cloud']]) assert.equal(locationOf(text), name, text);
  for (const near of ['private cloud', 'hybrid', 'clouds', 'on', 'premise', 'edge', '', '__proto__', 'constructor']) assert.equal(locationOf(near), null, near);
  assert.equal(locationOf('Head Office', { 'head office': 'on-premise' }), 'on-premise');
  assert.equal(locationOf('head office', { 'head office': 'moon' }), null, 'an alias to nothing is nothing');
});

test('patterns: by name and other names, an alias, and nothing near', () => {
  for (const [text, name] of [['REST API', 'api'], ['gRPC', 'api'], ['Pub/Sub', 'event'], ['message queue', 'event'], ['SFTP', 'file'], ['ETL', 'batch'], ['change data capture', 'database'], ['ESB', 'ipaas'], ['Integration Platform', 'ipaas']]) assert.equal(patternOf(text).name, name, text);
  for (const near of ['rest-ish', 'evnt', 'manual', '', 'toString']) assert.equal(patternOf(near), null, near);
  assert.equal(patternOf('EDI', { edi: 'file' }).name, 'file');
});

test('directions and authentications: names, strengths, and nothing near', () => {
  assert.equal(directionOf('One Way'), 'one-way');
  assert.equal(directionOf('bi-directional'), 'two-way');
  for (const near of ['sideways', 'two', 'one', '']) assert.equal(directionOf(near), null, near);
  for (const [text, name, strength] of [['OAuth 2.0', 'oauth2', 'strong'], ['client credentials', 'oauth2', 'strong'], ['Client Cert', 'mtls', 'strong'], ['IAM role', 'managed-identity', 'strong'], ['API Key', 'api-key', 'key'], ['bearer token', 'api-key', 'key'], ['presigned URL', 'sas', 'key'], ['Basic Auth', 'basic', 'weak'], ['anonymous', 'none', 'none']]) {
    assert.deepEqual([authenticationOf(text).name, authenticationOf(text).strength], [name, strength], text);
  }
  for (const near of ['oauht2', 'magic link', 'cert pinning', '', 'valueOf']) assert.equal(authenticationOf(near), null, near);
});

test('intervals: a number with a unit of time, a word, or a cron expression; nothing else', () => {
  for (const ok of ['15 min', '15min', 'every 2 h', 'Every 30 Minutes', '1.5 hours', '1 d', '2 weeks', 'hourly', 'Nightly', 'every day', '0 2 * * *', '*/15 * * * *', '0 0 12 * * ?', '30 1 1,15 * 1-5']) assert.equal(isInterval(ok), true, ok);
  for (const bad of ['', '15', '0 min', '15 parsecs', 'now and then', '* * * * *', '0 2 * *', '0 2 * * * * *', 'every', 'x'.repeat(201), '1500000000 s']) assert.equal(isInterval(bad), false, bad);
  assert.deepEqual(INTERVAL_WORDS.slice(0, 3), ['hourly', 'daily', 'nightly']);
  assert.ok(INTERVAL_UNITS.includes('min'));
});

test('triggers: real-time, scheduled, scheduled with an interval, an interval alone, and nothing near', () => {
  assert.deepEqual(triggerOf('Real-Time'), { name: 'real-time', interval: '' });
  assert.deepEqual(triggerOf('near real-time'), { name: 'real-time', interval: '' });
  assert.deepEqual(triggerOf('scheduled'), { name: 'scheduled', interval: '' });
  assert.deepEqual(triggerOf('hourly'), { name: 'scheduled', interval: 'hourly' });
  assert.deepEqual(triggerOf('scheduled every 15 min'), { name: 'scheduled', interval: 'every 15 min' });
  assert.deepEqual(triggerOf('cron 0 2 * * *'), { name: 'scheduled', interval: '0 2 * * *' });
  assert.deepEqual(triggerOf('daily at night'), { name: 'scheduled', interval: 'daily' });
  assert.deepEqual(triggerOf('every 5 min'), { name: 'scheduled', interval: 'every 5 min' });
  for (const near of ['whenever', 'real', 'sched', 'realtime please', '']) assert.equal(triggerOf(near), null, near);
});

test('yes and no: the flags, the encryption and the monitoring', () => {
  for (const v of ['yes', 'Y', 'TRUE', '1']) assert.equal(yesNo(v), true, v);
  for (const v of ['no', 'N', 'false', '0', 'none']) assert.equal(yesNo(v), false, v);
  for (const v of ['maybe', 'yess', '']) assert.equal(yesNo(v), null, v);
  for (const v of ['TLS', 'TLS 1.2', 'tls1.3', 'HTTPS', 'sftp', 'VPN', 'yes']) assert.equal(encryptionOf(v), true, v);
  for (const v of ['http', 'FTP', 'plain text', 'no']) assert.equal(encryptionOf(v), false, v);
  for (const v of ['tlsish', 'maybe', 'tls x']) assert.equal(encryptionOf(v), null, v);
  assert.equal(monitoringOf('Dashboard'), true);
  assert.equal(monitoringOf('not monitored'), false);
  assert.equal(monitoringOf('sometimes'), null);
});

test('none and error handling: words for none, several ways joined, and the parts not known', () => {
  for (const v of ['none', 'No', 'never', '0', 'no retries']) assert.equal(isNone(v), true, v);
  for (const v of ['3 tries', 'order id', 'nope', '']) assert.equal(isNone(v), false, v);
  assert.ok(NONE_WORDS.includes('none'));
  assert.deepEqual(errorHandlingOf('DLQ + Alert'), { names: ['dead-letter', 'alert'], unknown: [] });
  assert.deepEqual(errorHandlingOf('dead letter queue; dead-letter'), { names: ['dead-letter'], unknown: [] });
  assert.deepEqual(errorHandlingOf('alert / shrug'), { names: ['alert'], unknown: ['shrug'] });
  assert.deepEqual(errorHandlingOf(''), { names: [], unknown: [] });
  assert.deepEqual(errorHandlingOf('none'), { names: ['none'], unknown: [] });
});

test('boundaries: hybrid when one end is on-premise, crossing when hybrid or with a SaaS end', () => {
  assert.deepEqual(boundaryOf('cloud', 'on-premise'), { hybrid: true, crossing: true });
  assert.deepEqual(boundaryOf('on-premise', 'saas'), { hybrid: true, crossing: true });
  assert.deepEqual(boundaryOf('cloud', 'saas'), { hybrid: false, crossing: true });
  assert.deepEqual(boundaryOf('saas', 'saas'), { hybrid: false, crossing: true });
  assert.deepEqual(boundaryOf('cloud', 'cloud'), { hybrid: false, crossing: false });
  assert.deepEqual(boundaryOf('on-premise', 'on-premise'), { hybrid: false, crossing: false });
  assert.deepEqual(boundaryOf(null, 'cloud'), { hybrid: false, crossing: false });
  assert.equal(crossingText('cloud', 'on-premise'), 'crosses from cloud to on-premise, a hybrid flow,');
  assert.equal(crossingText('saas', 'cloud'), 'runs from saas to cloud, over the internet,');
  assert.deepEqual(['cloud', 'on-premise', 'saas'].map(whereText), ['in the cloud', 'on-premise', 'in a SaaS application']);
});
