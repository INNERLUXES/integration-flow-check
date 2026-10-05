// The words the tool reads in the fields of a flow, each with its other names. This is a documented data file:
// docs/inputs.md lists every name, and a change to it is made in a reviewed commit with a test of the name itself and
// of the name next to it that must not match (CONTRIBUTING.md). Check the list before you rely on it; teams write their
// inventories in many ways, and the configuration can add names for locations and patterns.
//
// Names are written as a reader would write them and compared in their term form (src/words.js), so "On-Premise",
// "on premise" and "ON_PREMISE" are one name. A name the tool does not know is reported, never matched to a near one.

import { termForm } from './words.js';

// The three locations of a system. The cloud is infrastructure or a platform the organization runs at a provider; a
// SaaS application is software the provider runs; on-premise is the organization's own site. "Private cloud" is not a
// name of any of them, because NIST SP 800-145 says a private cloud may be on or off the premises.
export const LOCATIONS = [
  { name: 'cloud', names: ['public cloud', 'iaas', 'paas', 'vpc', 'cloud hosted', 'cloud vm'] },
  { name: 'on-premise', names: ['on-premises', 'onprem', 'on-prem', 'onpremise', 'onpremises', 'on-site', 'onsite', 'data center', 'datacenter', 'data centre', 'own data center', 'local'] },
  { name: 'saas', names: ['software as a service', 'saas app', 'saas application'] }
];

// The six patterns of a flow. ipaas and event pass a flow through a hub; the other four connect two systems directly.
export const PATTERNS = [
  { name: 'api', hub: false, names: ['rest', 'rest api', 'soap', 'graphql', 'grpc', 'http', 'https api', 'web service', 'webservice', 'rpc'] },
  { name: 'event', hub: true, names: ['events', 'event bus', 'event driven', 'message', 'messaging', 'message queue', 'queue', 'pub sub', 'pubsub', 'publish subscribe', 'stream', 'streaming', 'webhook', 'webhooks'] },
  { name: 'file', hub: false, names: ['file transfer', 'files', 'sftp', 'ftp', 'ftps', 'mft', 'flat file', 'csv file', 'file drop'] },
  { name: 'batch', hub: false, names: ['etl', 'elt', 'bulk', 'batch job', 'bulk load', 'export import'] },
  { name: 'database', hub: false, names: ['db', 'db link', 'database link', 'direct database', 'shared database', 'replication', 'cdc', 'change data capture', 'jdbc', 'odbc', 'sql'] },
  { name: 'ipaas', hub: true, names: ['integration platform', 'integration platform as a service', 'esb', 'enterprise service bus', 'middleware', 'integration hub', 'hub'] }
];

export const DIRECTIONS = [
  { name: 'one-way', names: ['oneway', 'uni', 'unidirectional', 'uni-directional', 'single'] },
  { name: 'two-way', names: ['twoway', 'bidirectional', 'bi-directional', 'bi', 'both', 'both ways', 'sync both ways'] }
];

export const TRIGGERS = [
  { name: 'real-time', names: ['realtime', 'near real-time', 'nrt', 'instant', 'immediate', 'synchronous', 'on event', 'event driven', 'streaming', 'on change'] },
  { name: 'scheduled', names: ['schedule', 'cron', 'periodic', 'polling', 'poll', 'timer', 'timed', 'nightly', 'hourly', 'daily', 'weekly', 'monthly'] }
];

// The ways a flow proves who calls: strong (a token of a standard flow, a certificate or a managed identity), key (a
// shared secret that travels with every call), weak (a user name and a password), and none.
export const AUTHENTICATIONS = [
  { name: 'oauth2', strength: 'strong', names: ['oauth', 'oauth 2', 'oauth 2.0', 'oauth2.0', 'client credentials', 'oidc', 'openid connect'] },
  { name: 'mtls', strength: 'strong', names: ['mutual tls', 'client certificate', 'client cert', 'certificate', 'x509'] },
  { name: 'saml', strength: 'strong', names: ['saml2', 'saml 2.0'] },
  { name: 'jwt', strength: 'strong', names: ['signed jwt', 'jwt bearer'] },
  { name: 'kerberos', strength: 'strong', names: ['windows integrated', 'integrated windows'] },
  { name: 'managed-identity', strength: 'strong', names: ['iam role', 'iam', 'service account', 'workload identity', 'instance role'] },
  { name: 'ssh-key', strength: 'strong', names: ['ssh', 'sftp key', 'public key'] },
  { name: 'api-key', strength: 'key', names: ['apikey', 'key', 'static token', 'shared token', 'bearer token', 'token'] },
  { name: 'sas', strength: 'key', names: ['shared access signature', 'signed url', 'presigned url'] },
  { name: 'basic', strength: 'weak', names: ['basic auth', 'http basic', 'username password', 'user password', 'password', 'login'] },
  { name: 'none', strength: 'none', names: ['no', 'no auth', 'anonymous', 'open', 'public', 'unauthenticated'] }
];

// The handling of a message or record that cannot be delivered.
export const ERROR_HANDLING = [
  { name: 'dead-letter', names: ['dead letter queue', 'dead letter channel', 'dead letter topic', 'dlq', 'dlx', 'poison queue', 'error queue', 'parking lot'] },
  { name: 'alert', names: ['alerts', 'alerting', 'notify', 'notification', 'page', 'paging', 'on call', 'email alert'] },
  { name: 'none', names: ['no', 'ignore', 'ignored', 'drop', 'dropped', 'n'] }
];

// Yes and no, for the transport encryption, the monitoring and the personal data flag. A transport that encrypts
// (tls, https, sftp) reads as yes for the encryption; a value whose term form starts with "tls " (tls 1.2) too.
export const YES = ['yes', 'y', 'true', '1', 'on'];
export const NO = ['no', 'n', 'false', '0', 'off', 'none'];
export const ENCRYPTED = ['encrypted', 'tls', 'https', 'sftp', 'ftps', 'ssh', 'ipsec', 'vpn', 'mtls', 'ssl', 'amqps', 'private link', 'privatelink'];
export const UNENCRYPTED = ['unencrypted', 'plain', 'plaintext', 'plain text', 'http', 'ftp', 'clear text', 'cleartext'];
export const MONITORED = ['monitored', 'dashboard', 'alerts', 'alerting', 'tracing', 'apm'];
export const UNMONITORED = ['unmonitored', 'not monitored'];

// The values of a retry policy or an idempotency method that say there is none. Any other text is a policy or a
// method: the tool cannot tell whether it works.
export const NONE_WORDS = ['no', 'none', 'n', 'false', '0', 'never', 'off', 'not idempotent', 'no retry', 'no retries'];

// The words of an interval of a scheduled flow, besides a number with a unit of time and a cron expression.
export const INTERVAL_WORDS = ['hourly', 'daily', 'nightly', 'weekly', 'monthly', 'every minute', 'every hour', 'every day', 'every night', 'every week', 'every month'];

// The units of time an interval is written in.
export const INTERVAL_UNITS = ['s', 'sec', 'secs', 'second', 'seconds', 'm', 'min', 'mins', 'minute', 'minutes', 'h', 'hr', 'hrs', 'hour', 'hours', 'd', 'day', 'days', 'w', 'wk', 'week', 'weeks'];

// A map of every name of a list in its term form to the entry it stands for.
export const namesOf = (list) => new Map(list.flatMap((e) => [e.name, ...e.names].map((n) => [termForm(n), e])));
