// The rules and the result. Each rule names the points of the public pages it rests on (src/data.js), says where it is
// the tool's own choice, and what to change. docs/method.md says exactly what each rule looks at and what it cannot see.
// The checks themselves are in src/records.js and src/flows.js.

import { LEVELS } from './data.js';
import { grouped, plural } from './size.js';

const CROSSING = 'a flow crosses a boundary when one end is on-premise and the other in the cloud or a SaaS application (a hybrid flow), when one end is in the cloud and the other a SaaS application, or when both ends are SaaS applications; a flow between two on-premise systems or two cloud systems does not';

export const RULES = [
  {
    id: 'unknown-system',
    key: 'unknownSystem',
    title: 'a flow names a system the systems file does not list',
    basis: ['messageChannel'],
    own: 'only with a systems file: the source, the target and the data owner of a flow are compared in their term form with the names of the systems file; a near name is suggested, never used; the flow is still checked',
    rule: () => 'a flow whose source, target or data owner is not a system of the systems file, when one is given',
    fix: 'write the system as the systems file names it, or add the system to the systems file with its location'
  },
  {
    id: 'unknown-location',
    key: 'unknownLocation',
    title: 'a location is not cloud, on-premise or saas',
    basis: ['cloudModel', 'deploymentModels', 'privatePremises', 'saasModel'],
    own: 'a location is cloud, on-premise or saas, by one of the names of src/vocabulary.js or locationAliases; private cloud is not read as either, because a private cloud may be on or off the premises; an empty location is taken from the systems file when it lists the system, and otherwise reported',
    rule: (config) => `a flow end or a system whose location is empty or none of cloud, on-premise and saas and their names${Object.keys(config.locationAliases).length ? ` and the ${plural(Object.keys(config.locationAliases).length, 'alias', 'aliases')} of the configuration` : ''}`,
    fix: 'write cloud, on-premise or saas, add the system to the systems file with its location, or add the name your team uses to locationAliases in the configuration'
  },
  {
    id: 'location-conflict',
    key: 'locationConflict',
    title: 'a system has two locations',
    basis: ['deploymentModels', 'privatePremises'],
    own: 'a system has one location: a flow that gives a system another location than the systems file, or than an earlier flow when there is no systems file entry, is reported; the location the flow gives is used for that flow',
    rule: () => 'a flow end whose location differs from the location of the same system in the systems file or in an earlier flow',
    fix: 'correct the location in the flow or in the systems file; a system that runs in two places is two systems, named apart'
  },
  {
    id: 'unknown-pattern',
    key: 'unknownPattern',
    title: 'a pattern is not one the tool knows',
    basis: ['messageChannel', 'pointToPoint'],
    own: 'a pattern is api, event, file, batch, database or ipaas, by one of the names of src/vocabulary.js or patternAliases; a flow with no pattern the tool knows is left out of the count of direct connections',
    rule: (config) => `a flow whose pattern is empty or none of api, event, file, batch, database and ipaas and their names${Object.keys(config.patternAliases).length ? ` and the ${plural(Object.keys(config.patternAliases).length, 'alias', 'aliases')} of the configuration` : ''}`,
    fix: 'write api, event, file, batch, database or ipaas, or add the name your team uses to patternAliases in the configuration'
  },
  {
    id: 'unknown-value',
    key: 'unknownValue',
    title: 'a value is not one the tool reads',
    basis: ['messageChannel'],
    own: 'the direction, the trigger, the authentication, the encryption, the error handling, the monitoring and the personal data flag are read by the names of src/vocabulary.js; a value that is none of them is reported, never guessed, and the checks that need it are not run on it',
    rule: () => 'a flow whose direction, trigger, authentication, encryption, error handling, monitoring or personal data flag holds a value that is none of the names of src/vocabulary.js',
    fix: 'write one of the values docs/inputs.md lists for the field'
  },
  {
    id: 'duplicate-flow',
    key: 'duplicateFlow',
    title: 'two flows move the same data between the same systems',
    basis: ['idempotentReceiver', 'pointToPoint'],
    own: 'two flows are the same when their source, target and data are the same in their term form; a two-way flow is the same as another two-way flow between the same two systems in either order; a flow with no data named is not compared',
    rule: () => 'a flow whose source, target and data an earlier flow already has',
    fix: 'keep one flow for the data between the two systems, or name the data of each flow apart'
  },
  {
    id: 'duplicate-id',
    key: 'duplicateId',
    title: 'two flows have the same id',
    basis: ['messageChannel'],
    own: 'ids are compared in their term form; an id is optional, and a flow with no id is named by its source and target',
    rule: () => 'a flow whose id an earlier flow already has',
    fix: 'give every flow its own id'
  },
  {
    id: 'conflicting-writers',
    key: 'conflictingWriters',
    title: 'two systems write the same data into each other with no single data owner',
    basis: ['pointToPoint', 'idempotentReceiver'],
    own: 'a two-way flow with no data owner, and a flow from A to B with the same data as an earlier flow from B to A when the two do not name the same data owner, are reported: each side can overwrite the other and an update can go round in a loop',
    rule: () => 'a two-way flow with no data owner, or two flows that carry the same data in opposite directions without one data owner named by both',
    fix: 'name the system of record of the data in the data owner column of every flow that carries it, and let only that system write the data'
  },
  {
    id: 'no-encryption',
    key: 'noEncryption',
    title: 'a flow that crosses a boundary is not encrypted',
    basis: ['hybridCloud', 'broadNetworkAccess'],
    own: `${CROSSING}; a flow that crosses a boundary needs transport encryption written as yes or as an encrypting transport such as tls, https or sftp; an empty value is reported too`,
    rule: () => 'a hybrid flow, or a flow with a SaaS end, whose transport encryption is no or not stated',
    fix: 'encrypt the transport (TLS, HTTPS, SFTP, a VPN) and write it in the encryption column'
  },
  {
    id: 'weak-authentication',
    key: 'weakAuthentication',
    title: 'a flow that crosses a boundary has no authentication or basic authentication',
    basis: ['hybridCloud', 'broadNetworkAccess'],
    own: `${CROSSING}; such a flow with authentication none, basic (a user name and a password) or no authentication stated is reported`,
    rule: () => 'a hybrid flow, or a flow with a SaaS end, whose authentication is none, basic or not stated',
    fix: 'authenticate the flow with OAuth 2.0, mutual TLS or a managed identity, and write it in the authentication column'
  },
  {
    id: 'api-key-over-internet',
    key: 'apiKeyOverInternet',
    title: 'a flow that crosses a boundary authenticates with a static key',
    basis: ['broadNetworkAccess', 'saasModel'],
    own: `${CROSSING}; an API key or a shared access signature is a secret that travels with every call and is often long-lived, so a warning and not an error`,
    rule: () => 'a hybrid flow, or a flow with a SaaS end, whose authentication is an API key or a shared access signature',
    fix: 'use OAuth 2.0 or mutual TLS where the other system offers it, or keep the key in a vault, scope it to the flow and rotate it'
  },
  {
    id: 'personal-data-unencrypted',
    key: 'personalDataUnencrypted',
    title: 'a flow carries personal data with no encryption',
    basis: ['broadNetworkAccess'],
    own: 'a flow whose personal data flag is yes and whose transport encryption is no or not stated, wherever its ends are; an empty flag is read as no',
    rule: () => 'a flow with the personal data flag set and no transport encryption',
    fix: 'encrypt the transport of the flow, or take the personal data out of it'
  },
  {
    id: 'retry-without-idempotency',
    key: 'retryWithoutIdempotency',
    title: 'a flow retries with no idempotency',
    basis: ['idempotentReceiver', 'guaranteedDelivery'],
    own: 'a flow with a retry policy (any text but none or no) and no idempotency key or method; a retry after a lost reply sends the same record again, and without idempotency the target can write it twice',
    rule: () => 'a flow that names a retry policy and no idempotency key or method',
    fix: 'name the idempotency key or method the target uses to drop a repeated record, such as a message id it stores or an upsert on a business key'
  },
  {
    id: 'missing-retry',
    key: 'missingRetry',
    title: 'a real-time flow has no retry policy',
    basis: ['guaranteedDelivery'],
    own: 'a real-time flow with no retry policy, or with none; a scheduled flow is not reported, because its next run picks up what failed when it reads from a watermark',
    rule: () => 'a real-time flow with an empty retry policy or none',
    fix: 'write the retry policy of the flow, such as three tries with exponential backoff, and make the target idempotent'
  },
  {
    id: 'missing-interval',
    key: 'missingInterval',
    title: 'a scheduled flow has no interval',
    basis: ['guaranteedDelivery'],
    own: 'a scheduled flow needs an interval in the interval column or with its trigger: a number with a unit of time, a word such as hourly or nightly, or a cron expression; without one nobody can tell how stale the data of the target may be',
    rule: () => 'a scheduled flow with no interval, or with an interval the tool does not read',
    fix: 'write the interval, such as every 15 min, hourly or a cron expression'
  },
  {
    id: 'missing-error-handling',
    key: 'missingErrorHandling',
    title: 'a flow has no error handling',
    basis: ['deadLetter'],
    own: 'a flow whose error handling is empty or none; dead-letter and alert both count',
    rule: () => 'a flow with an empty error handling or none',
    fix: 'name what happens to a record that cannot be delivered: a dead letter queue someone reads, an alert, or both'
  },
  {
    id: 'missing-monitoring',
    key: 'missingMonitoring',
    title: 'a flow is not monitored',
    basis: ['deadLetter', 'guaranteedDelivery'],
    own: 'a flow whose monitoring is no or not stated; any form of yes counts, the tool cannot tell what is watched',
    rule: () => 'a flow whose monitoring is no or empty',
    fix: 'monitor the flow (runs, failures, lag) and write yes in the monitoring column'
  },
  {
    id: 'missing-owner',
    key: 'missingOwner',
    title: 'a flow has no owner',
    basis: ['deadLetter'],
    own: 'an owner per flow is the tool\'s own choice: a dead letter or an alert that nobody answers for is not acted on; any text counts as an owner',
    rule: () => 'a flow with an empty owner, or a flows file with no owner column',
    fix: 'name the team that answers for the flow and acts when it fails'
  },
  {
    id: 'point-to-point-sprawl',
    key: 'pointToPointSprawl',
    title: 'a system is connected directly to many others',
    basis: ['messageChannel', 'pointToPoint'],
    own: 'a direct connection is a flow of the api, file, batch or database pattern; event and ipaas flows go through a hub and are not counted; the other systems are counted once each, in either direction; info by default, because a hub is a design choice',
    rule: (config) => `a system connected directly to more than ${plural(config.maxDirectConnections, 'other system')}`,
    fix: 'route the flows of the system through a hub, such as an iPaaS or an event bus, so each system connects once'
  },
  {
    id: 'invalid-record',
    key: null,
    title: 'a record that cannot be read',
    basis: ['csvSameFields'],
    own: 'a CSV row with a different number of fields than the header, a JSON record that is not an object or names a field twice, a flow with no source or target, and a system with no name or named twice are not checked; a value of the wrong kind is taken as empty; this rule cannot be set lower or off',
    rule: () => 'a flow or system with the wrong number of fields, no source, target or name, a system named twice, or a value of the wrong kind',
    fix: 'correct the record at the line named'
  },
  {
    id: 'unreadable-file',
    key: null,
    title: 'a file that cannot be read',
    basis: ['jsonUtf8', 'csvRecords'],
    own: 'a file that is over its size limit, binary, UTF-16, not valid UTF-8 or not there to open is an error and nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a flows or systems file that the tool could not read as UTF-8 text',
    fix: 'export the file as UTF-8 CSV or JSON'
  },
  {
    id: 'unparsable-file',
    key: null,
    title: 'a file that is not CSV or JSON the readers accept, or not a list of flows or systems',
    basis: ['csvRecords', 'jsonRepeatedNames'],
    own: 'a quoted CSV field that is not closed, a stray double quote, a header that lacks a column the file needs or names one twice, JSON that does not parse or repeats a name, or JSON that is not a list of records stops the reading of the file, and nothing in it is checked; this rule cannot be set lower or off',
    rule: () => 'a flows or systems file that the CSV or JSON reader refuses, or whose header or shape is not that of its role',
    fix: 'correct the file at the line and column named'
  }
];

export const ruleById = (id) => RULES.find((r) => r.id === id);

// True when a level is at or above another.
export const atOrAbove = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

// The result: the run fails when a finding is at or above the level failOn. { pass, failOn, failing, byLevel, text }.
export function decide(findings, failOn) {
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of findings) byLevel[f.level] += 1;
  const failing = findings.filter((f) => atOrAbove(f.level, failOn)).length;
  const counts = ['error', 'warning', 'info'].filter((l) => byLevel[l]).map((l) => `${grouped(byLevel[l])} ${l}`);
  const text = failing
    ? `FAIL - ${plural(failing, 'finding')} at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`
    : `PASS - no finding at or above ${failOn}${counts.length ? ` (${counts.join(', ')})` : ''}`;
  return { pass: failing === 0, failOn, failing, byLevel, text };
}
