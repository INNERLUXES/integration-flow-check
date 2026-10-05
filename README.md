# integration-flow-check

Cloud integration flow check for teams that move systems to the cloud or connect them with SaaS applications. Give it
the inventory of your integration flows (each with an id, a source and a target system and where each runs, a pattern,
a direction, the data and the system that owns it, a trigger, the authentication, the transport encryption, a retry
policy, the idempotency, the error handling, the monitoring, an owner and a personal data flag), and optionally a list
of the known systems with their locations, as CSV or JSON, and it reports what an inventory of flows must not hold:
an unknown system, location, pattern or value, a flow listed twice, two systems that write the same data into each
other with no single owner, a hybrid flow with no encryption or with weak authentication, a static key over the
internet, personal data with no encryption, retries with no idempotency, a real-time flow with no retry, a scheduled
flow with no interval, a flow with no error handling, monitoring or owner, and a system connected directly to too many
others. It sums up each system and each pattern and exits with a code a pipeline can act on.

**It is a check of the inventory, not a certification.** It reads what the flows and the systems say. It connects to
no system, tests no connection or credential, and does not certify that an integration is secure, correct or
compliant with any standard.

An inventory of integration flows is usually a sheet that the architects start, the teams of each system fill in, and
the people who run the move to the cloud read before every wave. It drifts: the same flow is written twice, a system
is spelled two ways, a sync goes both ways and nobody says which side owns the data, a file transfer from the cloud to
the data center is plain FTP, a retry sends an order twice because nothing makes the target idempotent. The NIST
definition of cloud computing (https://csrc.nist.gov/pubs/sp/800/145/final) names the hybrid deployment model, and the
Enterprise Integration Patterns (https://www.enterpriseintegrationpatterns.com) name the channels, the idempotent
receiver and the dead letter channel that a flow is checked against. This tool reads the inventory on every change and
says which flows are not ready to cross the boundary between the site and the cloud.

- **Hybrid aware.** Each end of a flow is cloud, on-premise or saas, from the flow or from the systems file; a flow
  that crosses from the site to the cloud or to a SaaS application needs encryption and a strong authentication.
- **Data ownership.** A two-way flow with no data owner, and two flows that write the same data into each other
  without one owner, are reported as conflicting writers.
- **Delivery.** A retry with no idempotency key, a real-time flow with no retry, a scheduled flow with no interval, and
  a flow with no error handling or no monitoring.
- **Honest about input.** A file, a record or a value it cannot read is a finding with its line, never passed over; a
  name it does not know is reported with a near name suggested, never used. [docs/limits.md](docs/limits.md) says what
  the files cannot show.
- Reports as text, JSON, a CSV finding list and GitHub workflow annotations, with an exit code for a pipeline: `0` no
  finding at or above the `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network; the same files always give the same report.

```
npm test
```

```
tests 136
pass 133
fail 0
skipped 3
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link, a device or file permissions (a flows file, a systems file, a folder and a configuration named through a
symbolic link, `/dev/zero` named as an input, and a file with no read access); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same
tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/integration-flow-check.git
cd integration-flow-check
node bin/integration-flow-check.js examples/messy/flows.csv --systems examples/messy/systems.json --config examples/config.json
```

Or without a clone, on your own files:

```
npx --yes github:INNERLUXES/integration-flow-check flows.csv --systems systems.csv
```

`examples/` holds two made-up inventories. `examples/messy/` is a freight company in the middle of a move to the
cloud: a two-way customer sync with no data owner, basic authentication and retries with no idempotency key, two
employee flows that write the same data into each other, an unencrypted hybrid file transfer with no interval and no
monitoring, personal data with no encryption stated, an API key from a SaaS application to the cloud, a real-time flow
with no retry, a flow written twice, a pattern written as rest-ish, a target written as order-hbu, a location that
conflicts with the systems file, a private cloud, an unknown authentication and trigger, a row with no target, a flow
with no error handling and no owner, and an order hub connected directly to five systems. It also holds what must not
be reported: two on-premise systems that talk inside the site, the location head office and the pattern edi, which
`examples/config.json` names, and the words and the cron expression of its intervals. `examples/clean/` is a group of
clinics whose seven flows pass through one hub, all in good order.

## Usage

```
integration-flow-check <flows>... [--systems <file>]... [--config <file>] [options]
```

```
--systems <file>          a CSV or JSON file of the known systems and their locations; give it more than once for
                          several files
--config <file>           settings in strict JSON: rules, maxDirectConnections, locationAliases, patternAliases,
                          minSeverity and failOn (--print-defaults shows them)
--format <name>           text, json, csv or github (default: text); csv writes one row per finding, github writes
                          workflow commands that GitHub shows as annotations
--json                    the same as --format json
--min-severity <level>    the lowest level of a finding that is shown: info, warning, error (default: minSeverity of
                          the configuration, else info)
--fail-on <level>         the lowest level of a finding that fails the run: info, warning, error (default: failOn of
                          the configuration, else error)
--explain                 show the rule, the public sources and the tool's own choice behind each finding
--print-defaults          print the built-in configuration and exit
--help                    show the usage
--version                 show the version
```

The flows files are read in the order named and checked as one list, and so are the systems files. The path in the
report is relative to the folder you run the command in, with forward slashes on every system, followed by the line.

The report of the messy example starts with what was read, the configuration, the rules, the flows in one line and the
count of findings; then a table per system and per pattern; then the findings, errors first, each with what to change:

```
integration-flow-check: flows examples/messy/flows.csv; systems examples/messy/systems.json
input: flows examples/messy/flows.csv (1 file: 1 CSV file; 19 records); systems examples/messy/systems.json (1 file: 1 JSON file; 12 records)
config: examples/config.json (Brackenfold integration review): max direct connections 4; 1 location alias, 1 pattern alias; minimum severity info; fail on error
rules: unknown-system (error); unknown-location (error); location-conflict (error); unknown-pattern (error); unknown-value (error); duplicate-flow (error); duplicate-id (warning); conflicting-writers (error); no-encryption (error); weak-authentication (error); api-key-over-internet (warning); personal-data-unencrypted (error); retry-without-idempotency (error); missing-retry (warning); missing-interval (error); missing-error-handling (warning); missing-monitoring (warning); missing-owner (warning); point-to-point-sprawl (info); invalid-record (error); unreadable-file (error); unparsable-file (error)
flows: 18 flows: 8 hybrid, 11 crossing a boundary, 1 two-way, 10 real-time, 7 scheduled, 4 with personal data; 13 systems
findings: 24 (17 error, 6 warning, 1 info)

Systems (13)

  system          location    listed  out  in  hybrid  direct
  order-hub       cloud       yes     7    2   3       5
  warehouse-wms   on-premise  yes     2    3   3       2
  ledger-erp      on-premise  yes     1    1   2       2
  crm-suite       saas        yes     1    3   2       3
  billing         cloud       yes     1    2   1       3
  carrier-portal  saas        yes     0    1   0       1
  data-lake       cloud       yes     1    1   1       2
  hr-suite        saas        yes     1    1   2       1
  payroll         on-premise  yes     1    1   2       1
  label-printer   on-premise  yes     1    1   0       1
  customer-app    cloud       yes     1    1   0       2
  fleet-tracker   -           yes     1    0   0       0
  order-hbu       -           no      0    1   0       1

Patterns (7)

  pattern   hub  flows  hybrid  two-way
  api       no   8      4       1
  event     yes  2      1       0
  file      no   4      1       0
  batch     no   3      2       0
  database  no   0      0       0
  ipaas     yes  0      0       0
  unknown   no   1      0       0

Findings (24)

  ERROR    unknown-location           examples/messy/systems.json:15
           the system "fleet-tracker" has the location "private cloud", which is not cloud, on-premise or saas
           fix: write cloud, on-premise or saas, add the system to the systems file with its location, or add the name your team uses to locationAliases in the configuration

  ERROR    conflicting-writers        examples/messy/flows.csv:4
           the flow "F03" is two-way between ledger-erp and crm-suite and names no data owner, so both can write customers
           fix: name the system of record of the data in the data owner column of every flow that carries it, and let only that system write the data

  ERROR    weak-authentication        examples/messy/flows.csv:4
           the flow "F03" crosses from on-premise to saas, a hybrid flow, and authenticates with basic, a user name and a password
           fix: authenticate the flow with OAuth 2.0, mutual TLS or a managed identity, and write it in the authentication column

  ERROR    retry-without-idempotency  examples/messy/flows.csv:4
           the flow "F03" retries (3 tries) and names no idempotency key or method, so a repeated delivery can write a record twice
           fix: name the idempotency key or method the target uses to drop a repeated record, such as a message id it stores or an upsert on a business key

  ERROR    missing-interval           examples/messy/flows.csv:6
           the flow "F05" is scheduled and names no interval
           fix: write the interval, such as every 15 min, hourly or a cron expression

  ERROR    no-encryption              examples/messy/flows.csv:6
           the flow "F05" crosses from cloud to on-premise, a hybrid flow, and is not encrypted
           fix: encrypt the transport (TLS, HTTPS, SFTP, a VPN) and write it in the encryption column

  ERROR    no-encryption              examples/messy/flows.csv:8
           the flow "F07" crosses from saas to on-premise, a hybrid flow, and states no transport encryption
           fix: encrypt the transport (TLS, HTTPS, SFTP, a VPN) and write it in the encryption column

  ERROR    personal-data-unencrypted  examples/messy/flows.csv:8
           the flow "F07" carries personal data (employees) and states no transport encryption
           fix: encrypt the transport of the flow, or take the personal data out of it

  ERROR    conflicting-writers        examples/messy/flows.csv:9
           the flow "F08" writes employees from payroll into hr-suite, the flow at examples/messy/flows.csv:8 writes it from hr-suite into payroll, and the two do not name one data owner
           fix: name the system of record of the data in the data owner column of every flow that carries it, and let only that system write the data

  ERROR    duplicate-flow             examples/messy/flows.csv:11
           the flow "F01" moves orders from order-hub to warehouse-wms, as the flow at examples/messy/flows.csv:2 does
           fix: keep one flow for the data between the two systems, or name the data of each flow apart

  ERROR    unknown-pattern            examples/messy/flows.csv:15
           the flow "F14" has the pattern "rest-ish", which is not one of api, event, file, batch, database or ipaas
           fix: write api, event, file, batch, database or ipaas, or add the name your team uses to patternAliases in the configuration

  ERROR    unknown-system             examples/messy/flows.csv:17
           the flow "F16" names the target "order-hbu", which the systems file does not list, did you mean "order-hub"?
           fix: write the system as the systems file names it, or add the system to the systems file with its location

  ERROR    unknown-location           examples/messy/flows.csv:17
           the flow "F16" names no location for its target "order-hbu", and the systems file does not list it
           fix: write cloud, on-premise or saas, add the system to the systems file with its location, or add the name your team uses to locationAliases in the configuration

  ERROR    location-conflict          examples/messy/flows.csv:18
           the flow "F17" puts its source "data-lake" on-premise, and the systems file at examples/messy/systems.json:10 puts it in the cloud
           fix: correct the location in the flow or in the systems file; a system that runs in two places is two systems, named apart

  ERROR    unknown-value              examples/messy/flows.csv:18
           the flow "F17" has the authentication "magic link", which the tool does not know
           fix: write one of the values docs/inputs.md lists for the field

  ERROR    unknown-value              examples/messy/flows.csv:19
           the flow "F18" has the trigger "whenever", which is not real-time or scheduled
           fix: write one of the values docs/inputs.md lists for the field

  ERROR    invalid-record             examples/messy/flows.csv:20
           this row names no target system; the flow is not checked
           fix: correct the record at the line named

  WARNING  api-key-over-internet      examples/messy/flows.csv:5
           the flow "F04" runs from saas to cloud, over the internet, and authenticates with a static key (api-key)
           fix: use OAuth 2.0 or mutual TLS where the other system offers it, or keep the key in a vault, scope it to the flow and rotate it

  WARNING  missing-monitoring         examples/messy/flows.csv:6
           the flow "F05" is not monitored
           fix: monitor the flow (runs, failures, lag) and write yes in the monitoring column

  WARNING  missing-error-handling     examples/messy/flows.csv:7
           the flow "F06" has no error handling
           fix: name what happens to a record that cannot be delivered: a dead letter queue someone reads, an alert, or both

  WARNING  missing-owner              examples/messy/flows.csv:7
           the flow "F06" has no owner
           fix: name the team that answers for the flow and acts when it fails

  WARNING  missing-retry              examples/messy/flows.csv:10
           the flow "F09" is real-time and names no retry policy
           fix: write the retry policy of the flow, such as three tries with exponential backoff, and make the target idempotent

  WARNING  duplicate-id               examples/messy/flows.csv:11
           the flow "F01" has the id of the flow at examples/messy/flows.csv:2
           fix: give every flow its own id

  INFO     point-to-point-sprawl      examples/messy/flows.csv:2
           the system "order-hub" is connected directly to 5 other systems (warehouse-wms, carrier-portal, data-lake, customer-app and 1 more), more than 4; a hub such as an iPaaS or an event bus would connect it once
           fix: route the flows of the system through a hub, such as an iPaaS or an event bus, so each system connects once

note: examples/messy/systems.json: 1 key the tool does not read was left out: "company"
note: examples/messy/flows.csv: 1 column the tool does not read was left out: "notes"

This check reads the flow inventory as it is written. It connects to no system, tests no connection or credential, and does not certify that an integration is secure, correct or compliant (docs/limits.md).

RESULT: FAIL - 17 findings at or above error (17 error, 6 warning, 1 info)
```

With `--explain`, each finding also shows the rule, the points of the public pages it rests on and the tool's own
choice:

```
  ERROR    retry-without-idempotency  examples/messy/flows.csv:4
           the flow "F03" retries (3 tries) and names no idempotency key or method, so a repeated delivery can write a record twice
           fix: name the idempotency key or method the target uses to drop a repeated record, such as a message id it stores or an upsert on a business key
           rule: a flow that names a retry policy and no idempotency key or method
           basis: a receiver can get the same message more than once even when it was sent once, so it either removes duplicates or is built so a repeated message does no harm (Idempotent Receiver (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)
           basis: a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it (Guaranteed Delivery (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)
           the tool's own choice: a flow with a retry policy (any text but none or no) and no idempotency key or method; a retry after a lost reply sends the same record again, and without idempotency the target can write it twice

```

The clean example passes:

```
integration-flow-check: flows examples/clean/flows.json; systems examples/clean/systems.csv
input: flows examples/clean/flows.json (1 file: 1 JSON file; 7 records); systems examples/clean/systems.csv (1 file: 1 CSV file; 6 records)
config: built-in defaults: max direct connections 5; 0 location aliases, 0 pattern aliases; minimum severity info; fail on error
rules: unknown-system (error); unknown-location (error); location-conflict (error); unknown-pattern (error); unknown-value (error); duplicate-flow (error); duplicate-id (warning); conflicting-writers (error); no-encryption (error); weak-authentication (error); api-key-over-internet (warning); personal-data-unencrypted (error); retry-without-idempotency (error); missing-retry (warning); missing-interval (error); missing-error-handling (warning); missing-monitoring (warning); missing-owner (warning); point-to-point-sprawl (info); invalid-record (error); unreadable-file (error); unparsable-file (error)
flows: 7 flows: 2 hybrid, 4 crossing a boundary, 0 two-way, 5 real-time, 2 scheduled, 6 with personal data; 6 systems
findings: 0

Systems (6)

  system           location    listed  out  in  hybrid  direct
  integration-hub  cloud       yes     3    3   2       0
  patient-portal   saas        yes     1    1   0       0
  scheduling       cloud       yes     2    1   0       1
  lab-system       on-premise  yes     1    0   1       0
  records-db       on-premise  yes     0    1   1       0
  billing          cloud       yes     0    1   0       1

Patterns (6)

  pattern   hub  flows  hybrid  two-way
  api       no   1      0       0
  event     yes  1      0       0
  file      no   0      0       0
  batch     no   0      0       0
  database  no   0      0       0
  ipaas     yes  5      2       0

Findings (0)

  none

note: examples/clean/systems.csv: 1 column the tool does not read was left out: "notes"

This check reads the flow inventory as it is written. It connects to no system, tests no connection or credential, and does not certify that an integration is secure, correct or compliant (docs/limits.md).

RESULT: PASS - no finding at or above error
```

## How a flow is checked

1. Every value is trimmed, and an empty value, a dash or a blank word such as `n/a` or `tbd` counts as empty.
2. Each end of the flow gets its location: the flow's own location column, else the location of the system in the
   systems file. A location is `cloud`, `on-premise` or `saas`; a flow is hybrid when one end is on-premise and the
   other is not, and crosses a boundary when it is hybrid or has a SaaS end.
3. The pattern, the direction, the trigger with its interval, the authentication, the encryption, the error handling,
   the monitoring and the personal data flag are read by the names of `src/vocabulary.js`; a value it does not know is
   reported, never guessed.
4. A flow that crosses a boundary needs encryption and an authentication stronger than none or basic; a static key is
   a warning. A flow with personal data needs encryption wherever it runs.
5. A retry needs idempotency, a real-time flow needs a retry, a scheduled flow needs an interval, and every flow needs
   error handling, monitoring and an owner.
6. Flows are compared with each other: the same source, target and data twice is a duplicate, and two flows that write
   the same data in opposite directions need one data owner. A system connected directly (api, file, batch or database)
   to more than `maxDirectConnections` other systems gets a hint to use a hub.

[docs/method.md](docs/method.md) gives the details, and
[decision 3](docs/decisions/0003-read-a-flow-as-written-and-never-guess-a-location-or-a-value.md) says why a location
or a value is never guessed.

## What it reports

| Rule | Key | Default level | Finds |
| --- | --- | --- | --- |
| `unknown-system` | `rules.unknownSystem` | error | a source, target or data owner that the systems file does not list, with a near name suggested |
| `unknown-location` | `rules.unknownLocation` | error | a location that is empty or not cloud, on-premise or saas |
| `location-conflict` | `rules.locationConflict` | error | a system with another location than in the systems file or an earlier flow |
| `unknown-pattern` | `rules.unknownPattern` | error | a pattern that is empty or not api, event, file, batch, database or ipaas |
| `unknown-value` | `rules.unknownValue` | error | a direction, trigger, authentication, encryption, error handling, monitoring or personal data value the tool does not read |
| `duplicate-flow` | `rules.duplicateFlow` | error | the same source, target and data twice |
| `duplicate-id` | `rules.duplicateId` | warning | the same id twice |
| `conflicting-writers` | `rules.conflictingWriters` | error | a two-way flow with no data owner, or two flows that write the same data into each other with no single owner |
| `no-encryption` | `rules.noEncryption` | error | a flow that crosses a boundary with no transport encryption |
| `weak-authentication` | `rules.weakAuthentication` | error | a flow that crosses a boundary with authentication none, basic or not stated |
| `api-key-over-internet` | `rules.apiKeyOverInternet` | warning | a flow that crosses a boundary with an API key or a shared access signature |
| `personal-data-unencrypted` | `rules.personalDataUnencrypted` | error | personal data on a flow with no encryption |
| `retry-without-idempotency` | `rules.retryWithoutIdempotency` | error | a retry policy with no idempotency key or method |
| `missing-retry` | `rules.missingRetry` | warning | a real-time flow with no retry policy |
| `missing-interval` | `rules.missingInterval` | error | a scheduled flow with no interval the tool reads |
| `missing-error-handling` | `rules.missingErrorHandling` | warning | a flow with no error handling |
| `missing-monitoring` | `rules.missingMonitoring` | warning | a flow that is not monitored |
| `missing-owner` | `rules.missingOwner` | warning | a flow with no owner |
| `point-to-point-sprawl` | `rules.pointToPointSprawl` | info | a system connected directly to more than `maxDirectConnections` (5) others |
| `invalid-record` | none | error | a record with no source, target or name, the wrong number of fields, or a system listed twice |
| `unreadable-file` | none | error | a file that cannot be read as UTF-8 text |
| `unparsable-file` | none | error | a file the CSV or JSON reader refuses, or that lacks a column its role needs |

The three rules of input problems are always errors. [docs/method.md](docs/method.md) says exactly what each rule looks
at and what it cannot see, and [docs/rules-and-sources.md](docs/rules-and-sources.md) gives the points of the public
pages each rule rests on.

## The vocabulary

The words the tool reads, from `src/vocabulary.js`; each has other names, which docs/inputs.md lists.

| Field | Values |
| --- | --- |
| location | `cloud`, `on-premise`, `saas` |
| pattern | `api`, `event`, `file`, `batch`, `database`, `ipaas` |
| direction | `one-way`, `two-way` |
| trigger | `real-time`, `scheduled` (with an interval such as `every 15 min`, `hourly` or a cron expression) |
| authentication | `oauth2`, `mtls`, `saml`, `jwt`, `kerberos`, `managed-identity`, `ssh-key` (strong); `api-key`, `sas` (a static key); `basic`; `none` |
| encryption, monitoring, personal data | yes or no, with transports such as `tls`, `https` and `sftp` read as yes for the encryption |
| error handling | `dead-letter`, `alert`, `none`, several joined with `+` |

`event` and `ipaas` pass a flow through a hub; `api`, `file`, `batch` and `database` connect two systems directly.
`private cloud` is not read as a location, because a private cloud may be on or off the premises. The
`locationAliases` and `patternAliases` keys of the configuration add your team's own words.

## What is not checked

The tool reads what the files say and never guesses. It does not:

- connect to a system, an integration platform, a gateway or a network, or test a credential or a certificate;
- tell whether the flows in the inventory are all the flows that run, or whether a flow runs as written;
- judge whether an authentication or an encryption is configured well, or whether a retry policy or an idempotency
  key works: any text counts;
- check a data protection law, a contract or a certification: it is not a certification;
- tell whether two names of data are the same data, or whether two systems with different names are one;
- read a spreadsheet file (`.xlsx`, `.ods`): export it as UTF-8 CSV.

So a clean run means the files hold none of the problems the rules look for, and every report says so.

## The flows and the systems

```
id,source,source location,target,target location,pattern,direction,data,data owner,trigger,interval,auth,encryption,retry,idempotency,error handling,monitoring,owner,personal data
F01,order-hub,cloud,warehouse-wms,on-premise,api,one-way,orders,order-hub,real-time,,oauth2,tls,3 tries,order id,dead-letter,yes,fulfilment-team,no
```

```
system,location
order-hub,cloud
warehouse-wms,on-premise
```

A CSV file has a header line; a JSON file is a list of records, or an object with a `flows` or `systems` list. A flows
file needs `source` and `target`, a systems file `name` and `location`. Columns and keys are matched by name in any
case and order, with spaces, hyphens and underscores ignored, so `source location`, `source_location` and
`sourceLocation` all name the location of the source, and `auth`, `authentication` and `auth method` the
authentication. Columns the tool does not read are named in a note. [docs/inputs.md](docs/inputs.md) describes every
field.

## The configuration file

```json
{
  "name": "Brackenfold integration review",
  "maxDirectConnections": 4,
  "locationAliases": { "head office": "on-premise" },
  "patternAliases": { "edi": "file" }
}
```

Every key is optional, and without `--config` the defaults apply. `rules` sets the level of each rule (`info`,
`warning`, `error` or `off`), `maxDirectConnections` the number of systems one system may be connected to directly
before a hub is suggested (5 by default), `locationAliases` and `patternAliases` add other names, `minSeverity` sets
the lowest level shown and `failOn` the lowest level that fails the run. A key the tool does not know is an error with
its line and a suggestion, and a key named twice is refused. [docs/inputs.md](docs/inputs.md) describes every key, and
`--print-defaults` writes the whole default configuration out.

## Formats

- `text`: for a terminal: what was read, the configuration, the rules, the flows in one line, a table per system and
  per pattern, the findings with the file and line and what to change, the notes, the notice and the result. With
  `--explain` also the rule, the points of the public pages and the tool's own choice behind each finding.
- `json` (or `--json`): the whole report: the input, the configuration, the summary per system and per pattern, every
  finding with its file, line, column, flow, source and target, the totals, the result, the notes and the notice.
- `csv`: the findings, one record per finding, ready for a sheet: the level, the rule, the file, line and column, the
  flow, the source, the target, what was found and what to change, with CRLF line ends as RFC 4180 writes. A field
  that a spreadsheet could read as a formula gets a single quote in front. The start of the messy example:

```
level,rule,file,line,column,flow,source,target,found,fix
error,unknown-location,examples/messy/systems.json,15,44,,fleet-tracker,,"the system ""fleet-tracker"" has the location ""private cloud"", which is not cloud, on-premise or saas","write cloud, on-premise or saas, add the system to the systems file with its location, or add the name your team uses to locationAliases in the configuration"
error,conflicting-writers,examples/messy/flows.csv,4,50,F03,ledger-erp,crm-suite,"the flow ""F03"" is two-way between ledger-erp and crm-suite and names no data owner, so both can write customers","name the system of record of the data in the data owner column of every flow that carries it, and let only that system write the data"
error,weak-authentication,examples/messy/flows.csv,4,62,F03,ledger-erp,crm-suite,"the flow ""F03"" crosses from on-premise to saas, a hybrid flow, and authenticates with basic, a user name and a password","authenticate the flow with OAuth 2.0, mutual TLS or a managed identity, and write it in the authentication column"
```

- `github`: one workflow command per finding, `::error`, `::warning` or `::notice` (for info) with the file, line and
  column, which GitHub shows as an annotation in the pull request, then a summary line. The characters a command gives
  a meaning to are escaped. Two findings of the messy example:

```
::error file=examples/messy/flows.csv,line=4,col=62,title=integration-flow-check weak-authentication::the flow "F03" crosses from on-premise to saas, a hybrid flow, and authenticates with basic, a user name and a password; fix: authenticate the flow with OAuth 2.0, mutual TLS or a managed identity, and write it in the authentication column
::warning file=examples/messy/flows.csv,line=10,col=85,title=integration-flow-check missing-retry::the flow "F09" is real-time and names no retry policy; fix: write the retry policy of the flow, such as three tries with exponential backoff, and make the target idempotent
```

## Exit codes

`0`: no finding at or above the fail-on level (`error` by default). `1`: at least one finding at or above it; with the
default, an unknown system, location, pattern or value, a duplicate flow, conflicting writers, a flow across a
boundary with no encryption or weak authentication, personal data with no encryption, a retry with no idempotency, a
scheduled flow with no interval, or a file or record the tool could not read; with `--fail-on warning`, duplicate ids,
static keys over the internet, real-time flows with no retry and flows with no error handling, monitoring or owner too.
`2`: a usage or input error: no flows file, an unknown option, an option given twice, `--explain` with the csv or
github format, a URL in place of a path, a path that cannot be read, a symbolic link or a folder named on the command
line, a file whose name does not end in `.csv` or `.json`, input past the limit of a run, or a configuration with an
unknown key, a key named twice or a value of the wrong kind. With exit code `2` the tool gives no result and prints the
problems on standard error.

## Limits

The tool reads files; it does not connect to the systems, test the flows or track time. A run reports what the files
hold in the forms of docs/method.md. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size limits:
32 MB for a file, 256 MB for a run, 200,000 records in a file, 500 findings listed per rule.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading an inventory from a pull request and their
controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration, the flows and the systems, and builds the report of the run |
| `src/files.js`, `src/kinds.js` | the bounded reading of files with no link followed, and the kind of each file |
| `src/csv.js`, `src/json.js` | the CSV reader and the CSV finding list, and the strict JSON reader |
| `src/records.js` | the fields of a flow or system from a CSV header or JSON keys, and the records that cannot be read |
| `src/vocabulary.js` | the locations, patterns, directions, triggers, authentications and other words, as a documented data file |
| `src/terms.js` | the values of a flow read from their text, intervals included |
| `src/flows.js` | the checks of every system and flow, and the summary per system and per pattern |
| `src/config.js`, `src/defaults.js` | the configuration file over the defaults |
| `src/rules.js` | the rules, their levels and the result |
| `src/report.js`, `src/text.js`, `src/size.js`, `src/words.js` | the text, JSON and GitHub output, the cleaning of text from the input, number formats and compared words |
| `src/data.js` | the public pages and the points the rules rest on, in this project's own words |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| The deployment models, hybrid among them | NIST SP 800-145, https://csrc.nist.gov/pubs/sp/800/145/final |
| The hybrid cloud, the private cloud on or off the premises, SaaS and broad network access | NIST SP 800-145, full text, https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf |
| Channels between applications | Enterprise Integration Patterns, https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html |
| One receiver per message on a point-to-point channel | Enterprise Integration Patterns, https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html |
| Duplicate messages and the idempotent receiver | Enterprise Integration Patterns, https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html |
| Messages that cannot be delivered | Enterprise Integration Patterns, https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html |
| Messages kept until the next step holds them | Enterprise Integration Patterns, https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object, and UTF-8 | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| Formulas hidden in CSV files | OWASP, https://community.owasp.org/attacks/CSV_Injection |
| Annotations from workflow commands | GitHub Docs, https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands |

[research/sources.md](research/sources.md) has a note on each page, in this project's own words.

## Background

A move to the cloud is mostly a move of integrations: every flow between a system that moves and one that stays
becomes a hybrid flow that crosses the internet, and every SaaS application adds flows of its own. An inventory that
is checked on every change finds the flow that is still plain FTP, the sync with two writers and the retry that will
write an order twice while they are still one line in a sheet. How such flows are planned and built is described on the
page [Cloud Integration Services](https://innerluxes.dev/application/integration/cloud).

## License

MIT
