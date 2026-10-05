# Method

This document says exactly what the tool reads, how it reads each value, what each rule looks at and cannot see, and
how the report is built. The names used here are the defaults; docs/inputs.md says how the configuration changes them.
The tool is a check of the files, not a certification: it reads the inventory of flows and the list of systems as they
are written and reports what they hold. It connects to no system and never decides whether an integration is secure.

## What is read

The input is one or more flows files, any number of systems files and, if given, a configuration file. Each file named
on the command line is read once, in the order named; a folder is not walked. A name ending in `.csv` is read as CSV
and a name ending in `.json` as JSON. Each file is read as UTF-8, with or without a byte order mark, with LF, CR LF or
CR line ends.

A CSV file starts with a header line. Its columns are matched to the fields by name, in any order, with the letters A
to Z lowered and spaces, hyphens and underscores taken out, so `Source Location`, `source_location` and
`sourceLocation` are the same column. A JSON file is a list of records, or an object with a `flows` or `systems` list;
the keys of a record are matched the same way, and `true` and `false` are read as yes and no. Columns and keys the tool
does not read are named in a note. Every value is trimmed of white space at both ends, and a run of white space inside
it, a line break included, is read as one space. docs/inputs.md lists the fields.

All the systems files of a run make one list of systems, and all the flows files one list of flows, in the order of the
files and of the records in each.

## How a value is read

1. **Blank values.** A value that is empty, a dash, a question mark or a blank word such as `n/a` or `tbd` counts as
   empty (docs/inputs.md lists the words). `none` is not a blank word: it is a value, and says there is none.
2. **Names.** Systems, data, ids and owners are compared in their term form: the letters A to Z lowered and every run
   of other characters made one space, so `Order Hub` and `order-hub` are one system.
3. **Words.** The location, the pattern, the direction, the trigger, the authentication, the encryption, the error
   handling, the monitoring and the personal data flag are compared in their term form with the names of
   src/vocabulary.js, and the location and the pattern also with the aliases of the configuration. A value that is none
   of them is reported, with the nearest known name suggested when one is within a third of its length; the suggestion
   is never used.
4. **The interval.** A scheduled flow takes its interval from the interval column, or from its trigger (`scheduled
   every 15 min`, `hourly`, or an interval alone). An interval is a number above zero with a unit of time (`15 min`,
   `every 2 h`), one of the words `hourly`, `daily`, `nightly`, `weekly`, `monthly` and their `every` forms, or a cron
   expression of five or six fields. A trigger left empty with an interval given is read as scheduled.
5. **Free text.** A retry policy and an idempotency method are any text but a word for none (`no`, `none`, `never`,
   `0`); an owner is any text.

## How a flow is checked

Each end of a flow gets its location: the location column of that end, or, when it is empty, the location of the
system in the systems file. A flow is **hybrid** when one end is on-premise and the other is in the cloud or a SaaS
application, and **crosses a boundary** when it is hybrid or has a SaaS end
([decision 2](decisions/0002-decide-hybrid-from-the-locations-of-the-two-ends.md)). A flow with an end whose location
is not known is neither.

Then each flow is checked on its own, in the order of the files and of the records in each, and compared with the
flows before it. The same flows, systems and configuration always give the same report: no clock, no random number, no
locale, and no order taken from a hash.

## Rules

Each finding has a rule, a level, the file, the line and column of the field it is about (or of the record when the
file has no such column), the flow, the source and the target, what was found and what to change. `--explain` adds the
rule, the points of the public pages it rests on, and the tool's own choice. docs/rules-and-sources.md lists the
points.

### `unknown-system`

Only with a systems file that could be read. A flow whose source, target or data owner, once compared, is not a
system of the systems file. One finding per field, with a near name when there is one. The flow is still checked.

### `unknown-location`

A system of the systems file with an empty location or one that is none of the names; a flow end whose location
column is empty and whose system the systems file does not list; a flow end whose location column holds a name the
tool does not know. One finding per system or flow end, at the location. A system of the systems file whose location
is not known is reported there once, not again at each of its flows.

### `location-conflict`

A flow end whose location differs from the location of its system in the systems file, or, for a system the systems
file does not list, from the location an earlier flow gave it. One finding per flow end, at the location. The location
the flow gives is used for that flow.

### `unknown-pattern`

A flow whose pattern is empty, or none of `api`, `event`, `file`, `batch`, `database` and `ipaas`, their names and the
aliases. One finding per flow. The flow is left out of the count of direct connections and counted as unknown in the
summary per pattern.

### `unknown-value`

A flow whose direction, trigger, authentication, encryption, error handling, monitoring or personal data flag holds a
value that is none of the names of src/vocabulary.js. One finding per field. The checks that need that value are not
run on it: an encryption the tool does not know is neither yes nor no, so `no-encryption` does not report it.

### `duplicate-flow`

A flow whose source, target and data, in their term form, an earlier flow already has; for two-way flows, the two
systems in either order. A flow with no data is not compared. One finding at the later flow, naming the first.

### `duplicate-id`

A flow whose id, in its term form, an earlier flow already has. One finding at the later flow.

### `conflicting-writers`

A two-way flow with no data owner, at the data owner (or the direction when the file has no data owner column); and a
one-way flow from A to B whose data an earlier one-way flow writes from B to A, when the two do not name the same data
owner, at the data. Each side can overwrite the other, and an update can go round in a loop.

### `no-encryption`

A flow that crosses a boundary whose encryption is a word for no, or empty. One finding per flow, at the encryption.

### `weak-authentication`

A flow that crosses a boundary whose authentication is `none`, `basic`, or empty. One finding per flow, at the
authentication.

### `api-key-over-internet`

A flow that crosses a boundary whose authentication is `api-key` or `sas`: a static secret that travels with every
call. A warning.

### `personal-data-unencrypted`

A flow whose personal data flag is yes and whose encryption is a word for no, or empty, wherever its ends are. One
finding per flow, at the flag. An empty flag is read as no.

### `retry-without-idempotency`

A flow with a retry policy and no idempotency key or method: a retry after a lost reply sends the record again, and
the target can write it twice. One finding per flow, at the idempotency.

### `missing-retry`

A real-time flow whose retry policy is empty or a word for none. A warning. A scheduled flow is not reported.

### `missing-interval`

A scheduled flow with no interval, or with an interval the tool does not read. One finding per flow, at the interval,
or at the trigger when the file has no interval column.

### `missing-error-handling`

A flow whose error handling is empty, or names only none. Dead-letter and alert both count. A warning.

### `missing-monitoring`

A flow whose monitoring is empty or a word for no. Any form of yes counts. A warning.

### `missing-owner`

A flow whose owner is empty, or a flows file with no owner column. A warning.

### `point-to-point-sprawl`

A system connected directly to more than `maxDirectConnections` (5) other systems. A direct connection is a flow of the
`api`, `file`, `batch` or `database` pattern; the other systems are counted once each, in either direction. One finding
per system, at the first flow that names it. Info by default.

### `invalid-record`

A record that cannot be read: a CSV row with a different number of fields than the header, a JSON record that is not
an object or names one field with two keys, a flow with no source or no target, a system with no name, or a system
listed a second time. The record is not checked. A JSON value of the wrong kind (an object, a list) is also reported
and is taken as empty. Always an error.

### `unreadable-file`

A file that cannot be read as UTF-8 text: over its size limit, holding a null byte, UTF-16, not valid UTF-8, or not
there to open when it is read. Nothing in it is checked. Always an error.

### `unparsable-file`

A file that the readers refuse: a CSV file that is empty, has a quoted field that is not closed, a character after a
closing quote or a double quote inside an unquoted field, a header that lacks a column the file needs (`source` and
`target`, or `name` and `location`) or names one field twice, or more records than the limit; a JSON file that does
not parse, repeats a name in an object, or is not a list of records or an object with the list of its role. Nothing in
it is checked. Always an error, with the line and column.

## Input problems

A path named on the command line that is missing, a symbolic link, a folder, a device or a pipe, a file whose name does
not end in `.csv` or `.json`, a file named twice, a configuration with a problem, and input past the limit of a run
(256 MB) stop the run with exit code `2` and no result. The problems are listed on standard error, the first twenty and
then a count.

## The report

The text report shows what was read, the configuration, the rules with their levels, the flows in one line (hybrid,
crossing a boundary, two-way, real-time, scheduled and with personal data, with the count of systems) and the count of
findings; then the summary per system, the systems of the systems file first and then the others in the order they
first appear, each with its location, whether the systems file lists it, its flows out and in, its hybrid flows and
the count of systems it is connected to directly; then the summary per pattern; then the findings, errors first, then
by file (the systems files before the flows files), line, column and rule; then the notes, the notice and the result.
The JSON report holds the same data. The CSV report is the finding list: one record per finding listed. The GitHub
report is one workflow command per finding.

The result counts every finding at or above the minimum severity, also the ones past the limit of 500 listed per rule.
