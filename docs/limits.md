# Limits

The tool reads an inventory of integration flows as it is written: CSV or JSON files that list flows with their ends,
locations, pattern, direction, data, owner of the data, trigger, authentication, encryption, retry policy, idempotency,
error handling, monitoring and owner, and files that list the systems with their locations. It is a check of the files,
not a certification. It connects to no system, integration platform, gateway or network, tests no connection or
credential, and asks nobody anything. A finding points at something in a file; a run without findings says only that
the files hold none of the problems of docs/method.md. Every report ends with a sentence that says so.

## What it cannot see

- **Whether an integration is secure or compliant.** The tool checks that a flow that crosses a boundary names an
  encryption and an authentication stronger than none or basic; it does not judge how they are configured, which
  cipher or token lifetime is used, or whether a flow meets a law, a contract or a standard. It is not a certification.
- **Whether the inventory is complete or true.** The tool reads the flows it is given. A flow that runs and is not in
  the file, or a flow written as encrypted that runs in plain text, is not seen.
- **Whether a policy works.** Any text is a retry policy, an idempotency method or an owner; the tool cannot tell
  whether the retry backs off, whether the key is unique, or whether the team still exists.
- **Time.** The tool reads no clock and no dates
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)): it checks that a scheduled flow
  has an interval it can read, never whether the flow ran on time, and it never works out how long an interval is.
- **The network between two cloud systems.** A flow between two cloud systems, or two on-premise systems, does not
  cross a boundary, even when it runs over a public endpoint; the tool cannot tell a public endpoint from a private one
  ([decision 2](decisions/0002-decide-hybrid-from-the-locations-of-the-two-ends.md)).
- **Where a private cloud runs.** `private cloud` is not read as a location, because it may be on or off the premises;
  write `cloud` or `on-premise`, or add an alias.
- **Whether two names are the same thing.** Systems, data, ids and owners are compared in their term form. `orders`
  and `sales orders` are two kinds of data, and `crm` and `crm-suite` two systems; a near system name is only
  suggested, and only when a systems file is given.
- **Data that flows through a hub.** The tool reads each flow from its source to its target. A flow from A to a hub and
  one from the hub to B are two flows; the tool does not join them into one from A to B, so a sync loop through a hub
  is not seen.
- **Several data in one flow.** The data of a flow is one text; `orders, invoices` is one kind of data to the tool.
- **Values it does not know.** src/vocabulary.js lists the words; a value that is not there is reported and the checks
  that need it are not run on it, until it is written in a known form or named with an alias of the configuration
  (locations and patterns only).
- **Names that differ by more than case and punctuation.** Values are read by name, never matched to a near one.
- **Spreadsheet files.** A sheet saved as `.xlsx` or `.ods` is not read; export it as UTF-8 CSV. A CSV file in another
  encoding, or saved as UTF-16, is an `unreadable-file` finding. The separator is always the comma.

## The readers

- The CSV reader follows RFC 4180, accepts LF and a lone CR as line ends too, keeps white space inside a field (the
  record reader trims it afterwards), and refuses a quoted field that is not closed, a character after a closing
  quote, and a double quote inside an unquoted field. It reads no other separator, no comment lines and no escapes with
  a backslash.
- The JSON reader follows RFC 8259 and refuses comments, trailing commas, single quotes and a name given twice in one
  object.

## Size limits

Past a limit, the input is refused with exit code `2` and no result, the file is an error finding, or, where the limit
is on the work and not the input, the report says so in a note.

| What | Limit |
| --- | --- |
| a flows or systems file | 32 MB; a larger file is an `unreadable-file` finding |
| all the files of a run | 256 MB |
| files on the command line | 100, flows and systems together |
| records in a file | 200,000; more is an `unparsable-file` finding |
| a CSV field or a JSON string | 65,536 characters |
| CSV fields in a record | 1,000 |
| JSON values in a file | 5,000,000, nested 32 deep |
| configuration file | 1 MB; nesting 32 deep; 500 aliases of each kind of up to 100 characters |
| suggestions of a near name | the first 100 unknown names of a run |
| findings of one rule | 500 listed; the rest are counted in a note and still count for the result |
| problems of the input | 20 listed; the rest are counted |

The tests check a hundred thousand flows between a thousand systems with every check to run, three thousand names the
tool does not know, values of sixty thousand characters for every pattern, and runs of hundreds of thousands of
quotes, commas, line breaks and brackets, each with a time check.
