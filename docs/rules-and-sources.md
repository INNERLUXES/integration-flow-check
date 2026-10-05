# Rules and sources

Every rule rests on points of public pages, written in this project's own words; this document lists them, with the
choices that are the tool's own and what to change. The same points are in src/data.js and are shown by `--explain`;
research/sources.md has a longer note on each page. The tool is a check of the files, not a certification: a point
says what a page says, and a finding says what the inventory holds, not whether an integration is secure or compliant.

## The locations

| Location | Where the system runs | Points |
| --- | --- | --- |
| `cloud` | infrastructure or a platform the organization runs at a provider | `deploymentModels`, `privatePremises` |
| `on-premise` | the organization's own site or data center | `privatePremises` |
| `saas` | an application the provider runs, reached over the network | `saasModel`, `broadNetworkAccess` |

A flow is hybrid when one end is on-premise and the other is not, which is the tool's own reading of the hybrid model
of `hybridCloud` for a single flow; it crosses a boundary when it is hybrid or has a SaaS end. `private cloud` is
not read as a location, because `privatePremises` says a private cloud may be on or off the premises.
Other names of `cloud`: public cloud, iaas, paas, vpc, cloud hosted, cloud vm. Other names of `on-premise`: on-premises, on premise, onprem, on-prem, on prem, onpremise, onpremises, on-site, onsite, data center, datacenter, data centre, own data center, local. Other names of `saas`: software as a service, saas app, saas application.

## The patterns

| Pattern | Through a hub | Points |
| --- | --- | --- |
| `api` | no | `messageChannel`, `pointToPoint` |
| `event` | yes | `messageChannel` |
| `file` | no | `messageChannel`, `pointToPoint` |
| `batch` | no | `messageChannel`, `pointToPoint` |
| `database` | no | `messageChannel`, `pointToPoint` |
| `ipaas` | yes | `messageChannel` |

The six patterns and which of them pass through a hub are the tool's own list; no page above defines them. The
Enterprise Integration Patterns describe channels between applications; the tool counts a flow of a pattern that does
not pass through a hub as a direct connection between its two systems. docs/inputs.md gives every other name.

## The rules

| Rule | Default level | Points |
| --- | --- | --- |
| `unknown-system` | error | `messageChannel` |
| `unknown-location` | error | `cloudModel`, `deploymentModels`, `privatePremises`, `saasModel` |
| `location-conflict` | error | `deploymentModels`, `privatePremises` |
| `unknown-pattern` | error | `messageChannel`, `pointToPoint` |
| `unknown-value` | error | `messageChannel` |
| `duplicate-flow` | error | `idempotentReceiver`, `pointToPoint` |
| `duplicate-id` | warning | `messageChannel` |
| `conflicting-writers` | error | `pointToPoint`, `idempotentReceiver` |
| `no-encryption` | error | `hybridCloud`, `broadNetworkAccess` |
| `weak-authentication` | error | `hybridCloud`, `broadNetworkAccess` |
| `api-key-over-internet` | warning | `broadNetworkAccess`, `saasModel` |
| `personal-data-unencrypted` | error | `broadNetworkAccess` |
| `retry-without-idempotency` | error | `idempotentReceiver`, `guaranteedDelivery` |
| `missing-retry` | warning | `guaranteedDelivery` |
| `missing-interval` | error | `guaranteedDelivery` |
| `missing-error-handling` | warning | `deadLetter` |
| `missing-monitoring` | warning | `deadLetter`, `guaranteedDelivery` |
| `missing-owner` | warning | `deadLetter` |
| `point-to-point-sprawl` | info | `messageChannel`, `pointToPoint` |
| `invalid-record` | error, always | `csvSameFields` |
| `unreadable-file` | error, always | `jsonUtf8`, `csvRecords` |
| `unparsable-file` | error, always | `csvRecords`, `jsonRepeatedNames` |

### `unknown-system`

A flow names a system the systems file does not list: a flow whose source, target or data owner is not a system of the systems file, when one is given.

Points:

- `messageChannel`: applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives (Message Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)

The tool's own choice: only with a systems file: the source, the target and the data owner of a flow are compared in their term form with the names of the systems file; a near name is suggested, never used; the flow is still checked.

What to change: write the system as the systems file names it, or add the system to the systems file with its location.

### `unknown-location`

A location is not cloud, on-premise or saas: a flow end or a system whose location is empty or none of cloud, on-premise and saas and their names.

Points:

- `cloudModel`: cloud computing gives network access on demand to a shared pool of configurable resources, and the definition sets it out in essential characteristics, three service models and four deployment models (NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC), https://csrc.nist.gov/pubs/sp/800/145/final)
- `deploymentModels`: the four deployment models are private, community, public and hybrid (NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC), https://csrc.nist.gov/pubs/sp/800/145/final)
- `privatePremises`: a private cloud serves one organization and may sit on or off its premises, while a public cloud sits on the premises of the provider (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)
- `saasModel`: in software as a service the consumer uses applications the provider runs on its own infrastructure, and controls neither the infrastructure nor, beyond some settings, the application (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a location is cloud, on-premise or saas, by one of the names of src/vocabulary.js or locationAliases; private cloud is not read as either, because a private cloud may be on or off the premises; an empty location is taken from the systems file when it lists the system, and otherwise reported.

What to change: write cloud, on-premise or saas, add the system to the systems file with its location, or add the name your team uses to locationAliases in the configuration.

### `location-conflict`

A system has two locations: a flow end whose location differs from the location of the same system in the systems file or in an earlier flow.

Points:

- `deploymentModels`: the four deployment models are private, community, public and hybrid (NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC), https://csrc.nist.gov/pubs/sp/800/145/final)
- `privatePremises`: a private cloud serves one organization and may sit on or off its premises, while a public cloud sits on the premises of the provider (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a system has one location: a flow that gives a system another location than the systems file, or than an earlier flow when there is no systems file entry, is reported; the location the flow gives is used for that flow.

What to change: correct the location in the flow or in the systems file; a system that runs in two places is two systems, named apart.

### `unknown-pattern`

A pattern is not one the tool knows: a flow whose pattern is empty or none of api, event, file, batch, database and ipaas and their names.

Points:

- `messageChannel`: applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives (Message Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)
- `pointToPoint`: a point-to-point channel makes sure that only one receiver consumes a given message, even when several receivers listen (Point-to-Point Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html)

The tool's own choice: a pattern is api, event, file, batch, database or ipaas, by one of the names of src/vocabulary.js or patternAliases; a flow with no pattern the tool knows is left out of the count of direct connections.

What to change: write api, event, file, batch, database or ipaas, or add the name your team uses to patternAliases in the configuration.

### `unknown-value`

A value is not one the tool reads: a flow whose direction, trigger, authentication, encryption, error handling, monitoring or personal data flag holds a value that is none of the names of src/vocabulary.js.

Points:

- `messageChannel`: applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives (Message Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)

The tool's own choice: the direction, the trigger, the authentication, the encryption, the error handling, the monitoring and the personal data flag are read by the names of src/vocabulary.js; a value that is none of them is reported, never guessed, and the checks that need it are not run on it.

What to change: write one of the values docs/inputs.md lists for the field.

### `duplicate-flow`

Two flows move the same data between the same systems: a flow whose source, target and data an earlier flow already has.

Points:

- `idempotentReceiver`: a receiver can get the same message more than once even when it was sent once, so it either removes duplicates or is built so a repeated message does no harm (Idempotent Receiver (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)
- `pointToPoint`: a point-to-point channel makes sure that only one receiver consumes a given message, even when several receivers listen (Point-to-Point Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html)

The tool's own choice: two flows are the same when their source, target and data are the same in their term form; a two-way flow is the same as another two-way flow between the same two systems in either order; a flow with no data named is not compared.

What to change: keep one flow for the data between the two systems, or name the data of each flow apart.

### `duplicate-id`

Two flows have the same id: a flow whose id an earlier flow already has.

Points:

- `messageChannel`: applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives (Message Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)

The tool's own choice: ids are compared in their term form; an id is optional, and a flow with no id is named by its source and target.

What to change: give every flow its own id.

### `conflicting-writers`

Two systems write the same data into each other with no single data owner: a two-way flow with no data owner, or two flows that carry the same data in opposite directions without one data owner named by both.

Points:

- `pointToPoint`: a point-to-point channel makes sure that only one receiver consumes a given message, even when several receivers listen (Point-to-Point Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html)
- `idempotentReceiver`: a receiver can get the same message more than once even when it was sent once, so it either removes duplicates or is built so a repeated message does no harm (Idempotent Receiver (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)

The tool's own choice: a two-way flow with no data owner, and a flow from A to B with the same data as an earlier flow from B to A when the two do not name the same data owner, are reported: each side can overwrite the other and an update can go round in a loop.

What to change: name the system of record of the data in the data owner column of every flow that carries it, and let only that system write the data.

### `no-encryption`

A flow that crosses a boundary is not encrypted: a hybrid flow, or a flow with a SaaS end, whose transport encryption is no or not stated.

Points:

- `hybridCloud`: a hybrid cloud is two or more distinct cloud infrastructures that stay separate entities but are bound together by technology that lets data and applications move between them (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)
- `broadNetworkAccess`: cloud capabilities are reached over the network through standard mechanisms, from many kinds of client (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a flow crosses a boundary when one end is on-premise and the other in the cloud or a SaaS application (a hybrid flow), when one end is in the cloud and the other a SaaS application, or when both ends are SaaS applications; a flow between two on-premise systems or two cloud systems does not; a flow that crosses a boundary needs transport encryption written as yes or as an encrypting transport such as tls, https or sftp; an empty value is reported too.

What to change: encrypt the transport (TLS, HTTPS, SFTP, a VPN) and write it in the encryption column.

### `weak-authentication`

A flow that crosses a boundary has no authentication or basic authentication: a hybrid flow, or a flow with a SaaS end, whose authentication is none, basic or not stated.

Points:

- `hybridCloud`: a hybrid cloud is two or more distinct cloud infrastructures that stay separate entities but are bound together by technology that lets data and applications move between them (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)
- `broadNetworkAccess`: cloud capabilities are reached over the network through standard mechanisms, from many kinds of client (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a flow crosses a boundary when one end is on-premise and the other in the cloud or a SaaS application (a hybrid flow), when one end is in the cloud and the other a SaaS application, or when both ends are SaaS applications; a flow between two on-premise systems or two cloud systems does not; such a flow with authentication none, basic (a user name and a password) or no authentication stated is reported.

What to change: authenticate the flow with OAuth 2.0, mutual TLS or a managed identity, and write it in the authentication column.

### `api-key-over-internet`

A flow that crosses a boundary authenticates with a static key: a hybrid flow, or a flow with a SaaS end, whose authentication is an API key or a shared access signature.

Points:

- `broadNetworkAccess`: cloud capabilities are reached over the network through standard mechanisms, from many kinds of client (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)
- `saasModel`: in software as a service the consumer uses applications the provider runs on its own infrastructure, and controls neither the infrastructure nor, beyond some settings, the application (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a flow crosses a boundary when one end is on-premise and the other in the cloud or a SaaS application (a hybrid flow), when one end is in the cloud and the other a SaaS application, or when both ends are SaaS applications; a flow between two on-premise systems or two cloud systems does not; an API key or a shared access signature is a secret that travels with every call and is often long-lived, so a warning and not an error.

What to change: use OAuth 2.0 or mutual TLS where the other system offers it, or keep the key in a vault, scope it to the flow and rotate it.

### `personal-data-unencrypted`

A flow carries personal data with no encryption: a flow with the personal data flag set and no transport encryption.

Points:

- `broadNetworkAccess`: cloud capabilities are reached over the network through standard mechanisms, from many kinds of client (NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST), https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf)

The tool's own choice: a flow whose personal data flag is yes and whose transport encryption is no or not stated, wherever its ends are; an empty flag is read as no.

What to change: encrypt the transport of the flow, or take the personal data out of it.

### `retry-without-idempotency`

A flow retries with no idempotency: a flow that names a retry policy and no idempotency key or method.

Points:

- `idempotentReceiver`: a receiver can get the same message more than once even when it was sent once, so it either removes duplicates or is built so a repeated message does no harm (Idempotent Receiver (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html)
- `guaranteedDelivery`: a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it (Guaranteed Delivery (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)

The tool's own choice: a flow with a retry policy (any text but none or no) and no idempotency key or method; a retry after a lost reply sends the same record again, and without idempotency the target can write it twice.

What to change: name the idempotency key or method the target uses to drop a repeated record, such as a message id it stores or an upsert on a business key.

### `missing-retry`

A real-time flow has no retry policy: a real-time flow with an empty retry policy or none.

Points:

- `guaranteedDelivery`: a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it (Guaranteed Delivery (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)

The tool's own choice: a real-time flow with no retry policy, or with none; a scheduled flow is not reported, because its next run picks up what failed when it reads from a watermark.

What to change: write the retry policy of the flow, such as three tries with exponential backoff, and make the target idempotent.

### `missing-interval`

A scheduled flow has no interval: a scheduled flow with no interval, or with an interval the tool does not read.

Points:

- `guaranteedDelivery`: a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it (Guaranteed Delivery (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)

The tool's own choice: a scheduled flow needs an interval in the interval column or with its trigger: a number with a unit of time, a word such as hourly or nightly, or a cron expression; without one nobody can tell how stale the data of the target may be.

What to change: write the interval, such as every 15 min, hourly or a cron expression.

### `missing-error-handling`

A flow has no error handling: a flow with an empty error handling or none.

Points:

- `deadLetter`: a message that the messaging system cannot or should not deliver may be moved to a dead letter channel instead of being lost (Dead Letter Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html)

The tool's own choice: a flow whose error handling is empty or none; dead-letter and alert both count.

What to change: name what happens to a record that cannot be delivered: a dead letter queue someone reads, an alert, or both.

### `missing-monitoring`

A flow is not monitored: a flow whose monitoring is no or empty.

Points:

- `deadLetter`: a message that the messaging system cannot or should not deliver may be moved to a dead letter channel instead of being lost (Dead Letter Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html)
- `guaranteedDelivery`: a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it (Guaranteed Delivery (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html)

The tool's own choice: a flow whose monitoring is no or not stated; any form of yes counts, the tool cannot tell what is watched.

What to change: monitor the flow (runs, failures, lag) and write yes in the monitoring column.

### `missing-owner`

A flow has no owner: a flow with an empty owner, or a flows file with no owner column.

Points:

- `deadLetter`: a message that the messaging system cannot or should not deliver may be moved to a dead letter channel instead of being lost (Dead Letter Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html)

The tool's own choice: an owner per flow is the tool's own choice: a dead letter or an alert that nobody answers for is not acted on; any text counts as an owner.

What to change: name the team that answers for the flow and acts when it fails.

### `point-to-point-sprawl`

A system is connected directly to many others: a system connected directly to more than 5 other systems.

Points:

- `messageChannel`: applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives (Message Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)
- `pointToPoint`: a point-to-point channel makes sure that only one receiver consumes a given message, even when several receivers listen (Point-to-Point Channel (Enterprise Integration Patterns), https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html)

The tool's own choice: a direct connection is a flow of the api, file, batch or database pattern; event and ipaas flows go through a hub and are not counted; the other systems are counted once each, in either direction; info by default, because a hub is a design choice.

What to change: route the flows of the system through a hub, such as an iPaaS or an event bus, so each system connects once.

### `invalid-record`

A record that cannot be read: a flow or system with the wrong number of fields, no source, target or name, a system named twice, or a value of the wrong kind.

Points:

- `csvSameFields`: every line of a CSV file should hold the same number of fields (RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files, https://www.rfc-editor.org/rfc/rfc4180)

The tool's own choice: a CSV row with a different number of fields than the header, a JSON record that is not an object or names a field twice, a flow with no source or target, and a system with no name or named twice are not checked; a value of the wrong kind is taken as empty; this rule cannot be set lower or off.

What to change: correct the record at the line named.

### `unreadable-file`

A file that cannot be read: a flows or systems file that the tool could not read as UTF-8 text.

Points:

- `jsonUtf8`: JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start (RFC 8259, The JSON Data Interchange Format, https://www.rfc-editor.org/rfc/rfc8259)
- `csvRecords`: each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice (RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files, https://www.rfc-editor.org/rfc/rfc4180)

The tool's own choice: a file that is over its size limit, binary, UTF-16, not valid UTF-8 or not there to open is an error and nothing in it is checked; this rule cannot be set lower or off.

What to change: export the file as UTF-8 CSV or JSON.

### `unparsable-file`

A file that is not CSV or JSON the readers accept, or not a list of flows or systems: a flows or systems file that the CSV or JSON reader refuses, or whose header or shape is not that of its role.

Points:

- `csvRecords`: each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice (RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files, https://www.rfc-editor.org/rfc/rfc4180)
- `jsonRepeatedNames`: when an object repeats a name the behavior of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name (RFC 8259, The JSON Data Interchange Format, https://www.rfc-editor.org/rfc/rfc8259)

The tool's own choice: a quoted CSV field that is not closed, a stray double quote, a header that lacks a column the file needs or names one twice, JSON that does not parse or repeats a name, or JSON that is not a list of records stops the reading of the file, and nothing in it is checked; this rule cannot be set lower or off.

What to change: correct the file at the line and column named.

## Points that no rule rests on

- `csvInjection`: a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file (CSV Injection (OWASP), https://community.owasp.org/attacks/CSV_Injection). Behind the formula guard of `--format csv`.
- `githubAnnotations`: a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run (Workflow commands for GitHub Actions (GitHub Docs), https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands). Behind `--format github`.

## The pages

- NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC): https://csrc.nist.gov/pubs/sp/800/145/final
- NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST): https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf
- Message Channel (Enterprise Integration Patterns): https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html
- Point-to-Point Channel (Enterprise Integration Patterns): https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html
- Idempotent Receiver (Enterprise Integration Patterns): https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html
- Dead Letter Channel (Enterprise Integration Patterns): https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html
- Guaranteed Delivery (Enterprise Integration Patterns): https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html
- RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files: https://www.rfc-editor.org/rfc/rfc4180
- RFC 8259, The JSON Data Interchange Format: https://www.rfc-editor.org/rfc/rfc8259
- CSV Injection (OWASP): https://community.owasp.org/attacks/CSV_Injection
- Workflow commands for GitHub Actions (GitHub Docs): https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
