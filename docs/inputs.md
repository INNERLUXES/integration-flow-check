# Inputs

## The files

```
integration-flow-check <flows>... [--systems <file>]... [--config <file>] [options]
```

One or more flows files, then any number of systems files, each named with `--systems`; up to 100 files in all. Each
is a CSV file (a name ending in `.csv`) or a JSON file (a name ending in `.json`), compared without regard to case.
The flows files are read in the order they are named and checked together, and so are the systems files: a flow in one
file is compared with a flow in another, and a duplicate is found across files. Each file may be named once. A folder
is not walked; name the files. With no systems file no system is checked against a list, every flow must give the
locations of its ends itself, and the report says so in a note.

```
integration-flow-check flows.csv --systems systems.csv
integration-flow-check wave1.csv wave2.json --systems systems.csv --systems saas.json --fail-on warning
integration-flow-check flows.csv --systems systems.csv --config review.json --format github
```

### The fields of a flow

Only `source` and `target` are required; a field that is missing is empty.

| Field | Column or key names (any case; spaces, hyphens and underscores ignored) | Value |
| --- | --- | --- |
| `id` | `id`, `flowid`, `flow`, `flowname`, `name`, `interface`, `interfaceid` | the id of the flow, such as F01; optional, and a flow with no id is named by its source and target |
| `source` | `source`, `sourcesystem`, `from`, `fromsystem`, `sender`, `producer` | the system the data comes from |
| `target` | `target`, `targetsystem`, `to`, `tosystem`, `receiver`, `consumer`, `destination` | the system the data goes to |
| `sourceLocation` | `sourcelocation`, `sourcehosting`, `fromlocation` | where the source runs: cloud, on-premise or saas; empty to take it from the systems file |
| `targetLocation` | `targetlocation`, `targethosting`, `tolocation`, `destinationlocation` | where the target runs, as for the source |
| `pattern` | `pattern`, `integrationpattern`, `style`, `integrationstyle`, `mechanism` | api, event, file, batch, database or ipaas |
| `direction` | `direction`, `flowdirection` | one-way (the default when empty) or two-way |
| `data` | `data`, `dataobject`, `entity`, `businessobject`, `payload` | the data the flow moves, such as orders |
| `dataOwner` | `dataowner`, `systemofrecord`, `sor`, `recordowner`, `mastersystem`, `sourceoftruth` | the system of record of the data |
| `trigger` | `trigger`, `timing`, `mode`, `schedule`, `frequency` | real-time or scheduled, or scheduled with its interval |
| `interval` | `interval`, `scheduleinterval`, `runevery`, `every`, `cron` | how often a scheduled flow runs: 15 min, hourly, a cron expression |
| `authentication` | `authentication`, `auth`, `authmethod`, `authn`, `authenticationmethod` | how the flow proves who calls, such as oauth2, mtls or api-key |
| `encryption` | `encryption`, `encrypted`, `transportencryption`, `tls`, `encryptionintransit`, `intransitencryption` | yes or no, or the transport, such as tls, https or sftp |
| `retry` | `retry`, `retries`, `retrypolicy`, `retrystrategy` | the retry policy, such as 3 tries with backoff, or none |
| `idempotency` | `idempotency`, `idempotencykey`, `idempotent`, `deduplication`, `dedup` | the idempotency key or method, such as order id, or none |
| `errorHandling` | `errorhandling`, `onerror`, `onfailure`, `failurehandling` | dead-letter, alert or none, several joined with + |
| `monitoring` | `monitoring`, `monitored`, `observability` | yes or no |
| `owner` | `owner`, `team`, `flowowner`, `ownerteam`, `supportteam` | the team that answers for the flow |
| `personalData` | `personaldata`, `pii`, `personal`, `containspersonaldata` | yes or no; empty is no |

### The fields of a system

Both columns are required in a CSV systems file; a system with no name is an `invalid-record` finding, and one with no
location an `unknown-location` finding.

| Field | Column or key names | Value |
| --- | --- | --- |
| `name` | `name`, `system`, `systemname`, `application`, `app` | the name of the system, as the flows write it |
| `location` | `location`, `hosting`, `deployment`, `hostedat`, `where` | cloud, on-premise or saas |

Every value is trimmed of white space at both ends, and a run of white space inside it, a line break included, is
read as one space. A column or key that is none of these is left out and named in a note. A value that is empty, a dash, a question mark, or one of the words `n a`, `na`, `nil`, `tbd`, `tbc`, `todo`, `to do`, `unknown`, `not known`, `not set` (in
any case) counts as empty. `none` is not one of them: it is a value that says there is none.

Systems, data, ids and owners are compared in their term form: the letters A to Z lowered and every run of other
characters made one space, so `Order Hub`, `order-hub` and `order_hub` are one system.

### CSV

A header line names the columns, in any order, and every later line is a record. The file is read as RFC 4180
describes it, with LF, CRLF or a lone CR as line ends and a byte order mark skipped. A field that holds a comma, a
double quote or a line break is put in double quotes, with a double quote inside it written twice.

```
id,source,target,pattern,data,data owner,trigger,interval,auth,encryption,retry,idempotency,error handling,monitoring,owner
F01,order-hub,warehouse-wms,api,orders,order-hub,real-time,,oauth2,tls,3 tries,order id,dead-letter,yes,fulfilment-team
F02,billing,ledger-erp,file,invoices,billing,scheduled,every 30 min,ssh key,sftp,none,,dead-letter + alert,yes,finance-team
```

```
system,location
order-hub,cloud
warehouse-wms,on-premise
ledger-erp,on-premise
billing,cloud
```

A line with no text in any field is skipped. A line with a different number of fields than the header, a flow with no
source or no target, and a system with no name are `invalid-record` findings and are not checked. A file with no
header, a header that lacks a column the file needs (`source` and `target` in a flows file, `name` and
`location` in a systems file) or names one field twice, or a quote that breaks the format is an `unparsable-file`
finding.

### JSON

A list of record objects, or an object whose `flows` key (in a flows file) or `systems` key (in a systems file) holds
that list; other keys of that object are left out and named in a note. The file is read strictly as RFC 8259 writes
JSON: no comments, no trailing comma, and no name given twice in one object.

```json
{
  "flows": [
    { "id": "T05", "source": "lab-system", "target": "integration-hub", "pattern": "ipaas", "data": "lab results",
      "dataOwner": "lab-system", "trigger": "scheduled", "interval": "every 15 min", "auth": "mtls", "encryption": "tls",
      "retry": "2 tries", "idempotency": "result id", "errorHandling": "dead-letter", "monitoring": "yes",
      "owner": "lab-team", "personalData": true }
  ]
}
```

A value is a text, a number read as the text JavaScript writes for it, or `true` and `false` read as yes and no. A
value of another kind is an `invalid-record` finding and is taken as empty; a record that is not an object, has no
source, target or name, or names one field with two keys is an `invalid-record` finding and is not checked.

## The words

The words of each field are in `src/vocabulary.js`, a documented data file, and are compared in their term form. A
value that is none of them is reported, never matched to a near one
([decision 3](decisions/0003-read-a-flow-as-written-and-never-guess-a-location-or-a-value.md)).

### Locations

| Location | Other names |
| --- | --- |
| `cloud` | public cloud, iaas, paas, vpc, cloud hosted, cloud vm |
| `on-premise` | on-premises, onprem, on-prem, onpremise, onpremises, on-site, onsite, data center, datacenter, data centre, own data center, local |
| `saas` | software as a service, saas app, saas application |

`private cloud` is not a name of any of them: a private cloud may be on or off the premises, so write `cloud` or
`on-premise` for each system, or add an alias. A flow is hybrid when one end is on-premise and the other is in the
cloud or a SaaS application, and crosses a boundary when it is hybrid or has a SaaS end
([decision 2](decisions/0002-decide-hybrid-from-the-locations-of-the-two-ends.md)).

### Patterns

| Pattern | Through a hub | Other names |
| --- | --- | --- |
| `api` | no | rest, rest api, soap, graphql, grpc, http, https api, web service, webservice, rpc |
| `event` | yes | events, event bus, event driven, message, messaging, message queue, queue, pub sub, pubsub, publish subscribe, stream, streaming, webhook, webhooks |
| `file` | no | file transfer, files, sftp, ftp, ftps, mft, flat file, csv file, file drop |
| `batch` | no | etl, elt, bulk, batch job, bulk load, export import |
| `database` | no | db, db link, database link, direct database, shared database, replication, cdc, change data capture, jdbc, odbc, sql |
| `ipaas` | yes | integration platform, integration platform as a service, esb, enterprise service bus, middleware, integration hub, hub |

### Directions

| Direction | Other names |
| --- | --- |
| `one-way` | oneway, uni, unidirectional, uni-directional, single |
| `two-way` | twoway, bidirectional, bi-directional, bi, both, both ways, sync both ways |

An empty direction is read as one-way, from the source to the target.

### Triggers and intervals

| Trigger | Other names |
| --- | --- |
| `real-time` | realtime, near real-time, nrt, instant, immediate, synchronous, on event, event driven, streaming, on change |
| `scheduled` | schedule, cron, periodic, polling, poll, timer, timed, nightly, hourly, daily, weekly, monthly |

A scheduled flow needs an interval, in the interval column or with its trigger (`scheduled every 15 min`,
`hourly`, or an interval alone in the trigger column). An interval is a number above zero with one of the units
`s`, `sec`, `secs`, `second`, `seconds`, `m`, `min`, `mins`, `minute`, `minutes`, `h`, `hr`, `hrs`, `hour`, `hours`, `d`, `day`, `days`, `w`, `wk`, `week`, `weeks` (`15 min`, `every 2 h`); one of the words `hourly`, `daily`, `nightly`, `weekly`, `monthly`, `every minute`, `every hour`, `every day`, `every night`, `every week`, `every month`; or a cron expression of
five or six fields of digits and `* / , ? -`. A trigger left empty with an interval given is read as scheduled.

### Authentication

| Authentication | Strength | Other names |
| --- | --- | --- |
| `oauth2` | strong | oauth, oauth 2, oauth 2.0, oauth2.0, client credentials, oidc, openid connect |
| `mtls` | strong | mutual tls, client certificate, client cert, certificate, x509 |
| `saml` | strong | saml2, saml 2.0 |
| `jwt` | strong | signed jwt, jwt bearer |
| `kerberos` | strong | windows integrated, integrated windows |
| `managed-identity` | strong | iam role, iam, service account, workload identity, instance role |
| `ssh-key` | strong | ssh, sftp key, public key |
| `api-key` | key | apikey, key, static token, shared token, bearer token, token |
| `sas` | key | shared access signature, signed url, presigned url |
| `basic` | weak | basic auth, http basic, username password, user password, password, login |
| `none` | none | no, no auth, anonymous, open, public, unauthenticated |

A strong authentication passes every rule. A key (`api-key`, `sas`) on a flow that crosses a boundary is an
`api-key-over-internet` warning; `basic`, `none` or an empty authentication on such a flow is a
`weak-authentication` error.

### Encryption, monitoring and personal data

| Field | Yes | No |
| --- | --- | --- |
| encryption | `yes`, `y`, `true`, `1`, `on`, `encrypted`, `tls`, `https`, `sftp`, `ftps`, `ssh`, `ipsec`, `vpn`, `mtls`, `ssl`, `amqps`, `private link`, `privatelink`, and any value that starts with `tls` and a number, such as `TLS 1.3` | `no`, `n`, `false`, `0`, `off`, `none`, `unencrypted`, `plain`, `plaintext`, `plain text`, `http`, `ftp`, `clear text`, `cleartext` |
| monitoring | `yes`, `y`, `true`, `1`, `on`, `monitored`, `dashboard`, `alerts`, `alerting`, `tracing`, `apm` | `no`, `n`, `false`, `0`, `off`, `none`, `unmonitored`, `not monitored` |
| personal data | `yes`, `y`, `true`, `1`, `on` | `no`, `n`, `false`, `0`, `off`, `none`; empty is no |

### Error handling

| Error handling | Other names |
| --- | --- |
| `dead-letter` | dead letter queue, dead letter channel, dead letter topic, dlq, dlx, poison queue, error queue, parking lot |
| `alert` | alerts, alerting, notify, notification, page, paging, on call, email alert |
| `none` | no, ignore, ignored, drop, dropped, n |

Several ways are joined with `+`, `;` or `/`: `dead-letter + alert`.

### Retry and idempotency

Any text is a retry policy or an idempotency method, except an empty value and the words `no`, `none`, `n`, `false`, `0`, `never`, `off`, `not idempotent`, `no retry`, `no retries`, which
say there is none.

## Options

| Option | Value |
| --- | --- |
| `--systems <file>` | a systems file; give it once for each file |
| `--config <file>` | the configuration file below; without it the defaults apply |
| `--format <name>` | `text` (the default), `json`, `csv` or `github` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | `info`, `warning` or `error`: the lowest level of a finding that is shown; it wins over `minSeverity` of the configuration |
| `--fail-on <level>` | `info`, `warning` or `error`: the lowest level of a finding that fails the run; it wins over `failOn` of the configuration |
| `--explain` | each finding also shows its rule, the points of the public pages it rests on and the tool's own choice; with `--format csv` or `--format github` it is a usage error |
| `--print-defaults` | prints the built-in configuration as a configuration file and exits |
| `--help`, `--version` | the usage, the version |

A path that looks like a web address, an option given twice (other than `--systems`), `-` for standard input and an
unknown option are usage errors with exit code `2`.

## The configuration file

The configuration is one JSON object, read strictly as RFC 8259 writes JSON: no comments, no trailing comma, and no
name given twice in one object. Every key is optional. A key the tool does not know is an error with its line and, when
it is close to a known key, a suggestion; a run never goes on with a typo left in place.

```json
{
  "name": "Brackenfold integration review",
  "rules": { "missingOwner": "error", "pointToPointSprawl": "warning" },
  "maxDirectConnections": 4,
  "locationAliases": { "head office": "on-premise", "colo": "on-premise" },
  "patternAliases": { "edi": "file" },
  "minSeverity": "info",
  "failOn": "warning"
}
```

### `name`

A name for the configuration, 1 to 120 characters, shown in the report next to the file.

### `rules`

The level of each rule: `info`, `warning`, `error` or `off`. A rule set to `off` is not reported, and the report names
it in a note. The keys and their defaults:

| Key | Rule | Default |
| --- | --- | --- |
| `rules.unknownSystem` | `unknown-system` | error |
| `rules.unknownLocation` | `unknown-location` | error |
| `rules.locationConflict` | `location-conflict` | error |
| `rules.unknownPattern` | `unknown-pattern` | error |
| `rules.unknownValue` | `unknown-value` | error |
| `rules.duplicateFlow` | `duplicate-flow` | error |
| `rules.duplicateId` | `duplicate-id` | warning |
| `rules.conflictingWriters` | `conflicting-writers` | error |
| `rules.noEncryption` | `no-encryption` | error |
| `rules.weakAuthentication` | `weak-authentication` | error |
| `rules.apiKeyOverInternet` | `api-key-over-internet` | warning |
| `rules.personalDataUnencrypted` | `personal-data-unencrypted` | error |
| `rules.retryWithoutIdempotency` | `retry-without-idempotency` | error |
| `rules.missingRetry` | `missing-retry` | warning |
| `rules.missingInterval` | `missing-interval` | error |
| `rules.missingErrorHandling` | `missing-error-handling` | warning |
| `rules.missingMonitoring` | `missing-monitoring` | warning |
| `rules.missingOwner` | `missing-owner` | warning |
| `rules.pointToPointSprawl` | `point-to-point-sprawl` | info |

`invalid-record`, `unreadable-file` and `unparsable-file` are always errors and have no key.

### `maxDirectConnections`

A whole number from 1 to 1000 (5 by default): a system connected directly to more systems than this gets a
`point-to-point-sprawl` finding.

### `locationAliases`

An object of other names for the locations. Each name is compared in its term form; its value is `cloud`,
`on-premise` or `saas`, or another name of one of them. A name that is already a name of a location, a name given
twice once compared, and a value that is not a location are errors. At most 500 names of up to 100 characters.

### `patternAliases`

An object of other names for the patterns, read like `locationAliases`; its value is `api`, `event`, `file`,
`batch`, `database` or `ipaas`, or another name of one of them.

### `minSeverity`

The lowest level of a finding that is shown: `info` (the default), `warning` or `error`. The findings below it are
counted in a note and do not fail the run.

### `failOn`

The lowest level of a finding that fails the run: `info`, `warning` or `error` (the default).

`--print-defaults` writes the whole default configuration; read back, it gives the defaults.
