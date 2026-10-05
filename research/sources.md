# Sources

The public pages the checks of this tool are based on, each with a short note in this project's own words on what the
page says and which parts of the tool lean on it. Nothing here is a copy of a page: read the page itself for its exact
wording. src/data.js holds the pages and the points the reports show, src/vocabulary.js holds the words the tool reads,
and test/data.test.js checks that every page in src/data.js is listed here.
Each page was fetched and read before it was listed.

The tool is a check of the files it is given, not a certification. These notes say what the pages say so a reader can
follow a finding back to its source; they are not advice on how to secure any one integration.

## Cloud computing

### NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC)

https://csrc.nist.gov/pubs/sp/800/145/final

The publication page of the NIST definition. Its abstract describes cloud computing as a model for network access on
demand to a shared pool of configurable computing resources that can be provided and released with little management
effort, and says the model is made of essential characteristics, three service models (software, platform and
infrastructure as a service) and four deployment models: private, community, public and hybrid. The page links the
full text. The tool reads the location of a system as one of three places a flow can run, and `unknown-location` and
`location-conflict` lean on the deployment models.

### NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST)

https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf

The full text of the definition. It describes a private cloud as infrastructure for one organization that may be
managed by it or by a third party and may sit on or off its premises, and a public cloud as infrastructure open to the
public that sits on the premises of the provider. It describes a hybrid cloud as two or more distinct cloud
infrastructures that stay separate entities but are bound together by standard or proprietary technology that lets data
and applications move between them. It describes software as a service as applications the provider runs on its own
infrastructure, which the consumer reaches through a thin client such as a browser and does not manage, apart from some
settings. Among the essential characteristics it names broad network access: capabilities are reached over the network
through standard mechanisms, from many kinds of client. The tool calls a flow hybrid when one end is on-premise and the
other in the cloud or a SaaS application, does not read `private cloud` as a location, and leans on this text for
`no-encryption`, `weak-authentication`, `api-key-over-internet` and `personal-data-unencrypted`.

## Integration patterns

The Enterprise Integration Patterns site describes the patterns of messaging between applications, one page per
pattern, with a short summary of each and a link to the longer text of the book.

### Message Channel (Enterprise Integration Patterns)

https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html

Applications that exchange information through messaging are connected by a channel: one application writes to the
channel and another reads from it. Channels are set up by the kind of information they carry, and the sender writes to
a channel without having to know which application will read it. The tool reads each flow as such a connection from a
source to a target, and `unknown-system`, `unknown-pattern`, `unknown-value`, `duplicate-id` and
`point-to-point-sprawl` lean on it.

### Point-to-Point Channel (Enterprise Integration Patterns)

https://www.enterpriseintegrationpatterns.com/patterns/messaging/PointToPointChannel.html

A point-to-point channel makes sure that only one receiver consumes a given message; when several receivers listen on
the channel, only one of them gets each message, without the receivers having to agree among themselves. The tool
counts flows that connect two systems directly for `point-to-point-sprawl`, and leans on the idea of one receiver per
message for `duplicate-flow` and `conflicting-writers`: two flows that deliver the same data to the same place, or into
each other, break it.

### Idempotent Receiver (Enterprise Integration Patterns)

https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html

A receiver can get the same message more than once even when the sender sent it once. The page describes two ways to
cope: removing duplicates explicitly, or designing the messages so that receiving one again does no harm, which is
what idempotent means, a term taken from mathematics. `retry-without-idempotency`, `duplicate-flow` and
`conflicting-writers` lean on it.

### Dead Letter Channel (Enterprise Integration Patterns)

https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html

When the messaging system finds that it cannot or should not deliver a message, it may move the message to a dead
letter channel, often kept on each machine, where the failed message waits with a note of where it was going. The page
mentions queues that move a message there after a set number of delivery attempts. `missing-error-handling`,
`missing-monitoring` and `missing-owner` lean on it: a message that cannot be delivered needs a place to go and someone
who looks at it.

### Guaranteed Delivery (Enterprise Integration Patterns)

https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html

The messaging system keeps each message in a data store and does not delete it from one store until it is safely in
the next, so a failure on the way does not lose it; a send completes only when the message is stored. The tool leans on
it for `retry-without-idempotency` and `missing-retry`, because delivering again after a failure is what makes a
receiver see the same message twice, and for `missing-interval` and `missing-monitoring`, because a flow whose timing
and failures nobody can see cannot be relied on.

## Formats

### RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files

https://www.rfc-editor.org/rfc/rfc4180

The memo that describes CSV: each record on its own line, ended by CRLF, the last line break optional, an optional
header line first, fields separated by commas, spaces kept as part of a field, and every line with the same number of
fields. A field that holds a comma, a double quote or a line break is put in double quotes, and a double quote inside
such a field is written twice. The reader of the tool follows it, accepts LF and a lone CR as line ends too, and refuses
a quoted field that is not closed or a double quote in a field that does not start with one (`unparsable-file`); a row
with a different number of fields than the header is an `invalid-record` finding. `--format csv` writes the finding
list this way, with CRLF line ends.

### RFC 8259, The JSON Data Interchange Format

https://www.rfc-editor.org/rfc/rfc8259

The JSON standard. Its section on objects says the names in an object should be unique and that programs behave in
different ways when they are not; the reader of the tool refuses a repeated name instead of keeping one of the values,
so a flow or a setting never depends on which value a library would keep. Its section on encoding asks for UTF-8
between systems and lets a reader ignore a byte order mark; the tool reads UTF-8 only, skips a byte order mark, and
reports a UTF-16 file as an `unreadable-file` finding.

### CSV Injection (OWASP)

https://community.owasp.org/attacks/CSV_Injection

The page on formulas hidden in CSV files. A spreadsheet may treat a cell that starts with `=`, `+`, `-`, `@`, a tab or
a line break as a formula, and the page warns that no single way of escaping is safe in every program and for every
later reader. The CSV format of the tool puts a single quote in front of such a field, and docs/threat-model.md says
why that is a help and not a guarantee.

### Workflow commands for GitHub Actions (GitHub Docs)

https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

The page that describes the `::notice`, `::warning` and `::error` commands with their `file`, `line`, `col` and
`title` properties, which turn a line of output into an annotation on a file. `--format github` writes one such command
per finding, info as a notice, and escapes the characters a command gives a meaning to.
