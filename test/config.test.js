import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, DEFAULT_FAIL_ON, DEFAULT_LOCATION_ALIASES, DEFAULT_MAX_DIRECT_CONNECTIONS, DEFAULT_MIN_SEVERITY, DEFAULT_PATTERN_ALIASES, DEFAULT_RULES, KEYS, RULES, defaultConfig, defaultsAsConfig, distance, isObject, kindOf, readConfig, suggestion, validateConfig } from '../src/index.js';

// The configuration file: every key with a good value and a bad one, the suggestions, and the defaults.

const problems = (text) => {
  try {
    readConfig(text, 'c.json');
  } catch (error) {
    assert.ok(error instanceof ConfigError, error.message);
    return error.problems;
  }
  return assert.fail('not refused');
};

test('config: the defaults, and --print-defaults read back gives them', () => {
  const d = defaultConfig();
  assert.deepEqual(d.rules, DEFAULT_RULES);
  assert.equal(d.maxDirectConnections, DEFAULT_MAX_DIRECT_CONNECTIONS);
  assert.equal(DEFAULT_MAX_DIRECT_CONNECTIONS, 5);
  assert.deepEqual(d.locationAliases, DEFAULT_LOCATION_ALIASES);
  assert.deepEqual(d.patternAliases, DEFAULT_PATTERN_ALIASES);
  assert.deepEqual([d.minSeverity, d.failOn], [DEFAULT_MIN_SEVERITY, DEFAULT_FAIL_ON]);
  const back = readConfig(JSON.stringify(defaultsAsConfig()), 'd.json');
  assert.deepEqual({ ...back, file: null, name: null }, d);
  assert.deepEqual(Object.keys(defaultsAsConfig()), ['name', ...Object.keys(KEYS).filter((k) => k !== 'name')]);
  for (const r of RULES.filter((x) => x.key)) assert.ok(Object.hasOwn(DEFAULT_RULES, r.key), r.key);
  assert.equal(Object.keys(DEFAULT_RULES).length, RULES.filter((x) => x.key).length);
});

test('config: every key with a good value', () => {
  const c = readConfig(JSON.stringify({ name: 'Review', rules: { noEncryption: 'warning', pointToPointSprawl: 'off' }, maxDirectConnections: 3, locationAliases: { 'Head Office': 'On-Prem', colo: 'on-premise' }, patternAliases: { EDI: 'file', bridge: 'ESB' }, minSeverity: 'warning', failOn: 'warning' }), 'c.json');
  assert.equal(c.file, 'c.json');
  assert.equal(c.name, 'Review');
  assert.equal(c.rules.noEncryption, 'warning');
  assert.equal(c.rules.pointToPointSprawl, 'off');
  assert.equal(c.maxDirectConnections, 3);
  assert.deepEqual(c.locationAliases, { 'head office': 'on-premise', colo: 'on-premise' });
  assert.deepEqual(c.patternAliases, { edi: 'file', bridge: 'ipaas' });
  assert.deepEqual([c.minSeverity, c.failOn], ['warning', 'warning']);
});

test('config: an unknown key is an error with its line and a suggestion', () => {
  assert.deepEqual(problems('{\n  "failOm": "info",\n  "rules": {\n    "noEncrypton": "off"\n  }\n}'), ['c.json: line 2: "failOm" is not a key of the configuration; did you mean "failOn"?', 'c.json: line 4: "noEncrypton" is not a key of rules; did you mean "noEncryption"?']);
  assert.deepEqual(problems('{"maxDirectConnection": 3}'), ['c.json: line 1: "maxDirectConnection" is not a key of the configuration; did you mean "maxDirectConnections"?']);
  assert.deepEqual(problems('{"colour": 1}'), ['c.json: line 1: "colour" is not a key of the configuration']);
});

test('config: a value of the wrong kind for every key', () => {
  assert.deepEqual(problems('[]'), ['c.json: line 1: the configuration must be a JSON object, not a list']);
  assert.match(problems('{"name": ""}')[0], /name must be a text of 1 to 120 characters/);
  assert.match(problems('{"rules": []}')[0], /rules must be an object, not a list/);
  assert.match(problems('{"rules": {"missingOwner": "fatal"}}')[0], /rules\.missingOwner must be one of info, warning, error, off, not "fatal"/);
  assert.match(problems('{"rules": {"missingOwner": 1}}')[0], /not a number/);
  for (const v of ['0', '1.5', '1001', '"5"', 'null']) assert.match(problems(`{"maxDirectConnections": ${v}}`)[0], /maxDirectConnections must be a whole number from 1 to 1000/, v);
  assert.match(problems('{"minSeverity": "fatal"}')[0], /minSeverity must be one of info, warning, error/);
  assert.match(problems('{"failOn": null}')[0], /failOn must be one of info, warning, error/);
});

test('config: aliases that cannot be used', () => {
  assert.match(problems('{"locationAliases": []}')[0], /locationAliases must be an object of names to locations, not a list/);
  assert.match(problems('{"patternAliases": "edi"}')[0], /patternAliases must be an object of names to patterns, not a string/);
  assert.match(problems('{"locationAliases": {"On Prem": "cloud"}}')[0], /"On Prem" is already a name of the location on-premise/);
  assert.match(problems('{"locationAliases": {"dc2": "moon"}}')[0], /locationAliases\.dc2 must be one of cloud, on-premise, saas, not "moon"/);
  assert.match(problems('{"locationAliases": {"dc2": "clod"}}')[0], /did you mean "cloud"\?/);
  assert.match(problems('{"patternAliases": {"edi": 1}}')[0], /patternAliases\.edi must be one of api, event, file, batch, database, ipaas, not a number/);
  assert.match(problems('{"patternAliases": {"edi": "file", "EDI": "file"}}')[0], /"EDI" is the same name as "edi" once compared \(edi\)/);
  assert.match(problems('{"patternAliases": {"--": "file"}}')[0], /"--" must hold 1 to 100 characters with a letter or a digit/);
  const many = Object.fromEntries(Array.from({ length: CONFIG_LIMITS.maxAliases + 1 }, (_, i) => [`n${i}`, 'cloud']));
  assert.match(problems(JSON.stringify({ locationAliases: many }))[0], /holds more than 500 names/);
});

test('config: a repeated name and JSON that does not parse are refused, and the problems are in the order of their lines', () => {
  assert.match(problems('{"failOn": "info", "failOn": "error"}')[0], /^c\.json: line 1, column 20: the name "failOn" appears twice/);
  assert.match(problems('{"failOn": "info",}')[0], /^c\.json: line 1, column 19: a comma before the closing brace/);
  assert.deepEqual(problems('{\n"failOn": 1,\n"minSeverity": 2,\n"zz": 3\n}').map((p) => p.split(':')[1].trim()), ['line 2', 'line 3', 'line 4']);
});

test('config: suggestions, edit distance and the kinds of values', () => {
  assert.equal(distance('nmae', 'name'), 1);
  assert.equal(distance('', 'abc'), 3);
  assert.equal(distance('kitten', 'sitting'), 3);
  assert.equal(suggestion('order-hbu', ['order-hub', 'billing']), '; did you mean "order-hub"?');
  assert.equal(suggestion('x', ['cloud']), '');
  assert.equal(suggestion('y'.repeat(65), ['cloud']), '');
  assert.equal(kindOf(null), 'null');
  assert.equal(kindOf([]), 'a list');
  assert.equal(kindOf({}), 'an object');
  assert.equal(kindOf(1), 'a number');
  assert.equal(isObject({}), true);
  assert.equal(isObject([]), false);
  assert.throws(() => validateConfig(1), /the configuration must be a JSON object, not a number/);
  assert.deepEqual(validateConfig({}).rules, DEFAULT_RULES);
});
