# Changes

## 1.0.0

First release.

- Checks an inventory of integration flows between cloud, on-premise and SaaS systems: one or more flows files and
  systems files, as CSV (RFC 4180) or JSON (RFC 8259), with the columns and keys matched by name in any case and order.
  A flow has an id, a source and a target with their locations, a pattern, a direction, the data and its owner, a
  trigger with an interval, the authentication, the transport encryption, a retry policy, the idempotency, the error
  handling, the monitoring, an owner and a personal data flag; a system has a name and a location.
- The words of each field, with their other names, kept as a documented data file (`src/vocabulary.js`): the locations
  cloud, on-premise and saas, the patterns api, event, file, batch, database and ipaas, the directions, the triggers,
  the authentications with their strength, yes and no, and the ways to handle errors. `private cloud` is not read as a
  location, because a private cloud may be on or off the premises.
- A flow is hybrid when one end is on-premise and the other is not, and crosses a boundary when it is hybrid or has a
  SaaS end; the location of each end comes from the flow or from the systems file.
- Nineteen rules in three levels: unknown systems with a near name suggested, unknown or conflicting locations,
  unknown patterns and values (`unknown-system`, `unknown-location`, `location-conflict`, `unknown-pattern`,
  `unknown-value`), duplicate flows and ids (`duplicate-flow`, `duplicate-id`), two-way flows or flows in opposite
  directions with no single data owner (`conflicting-writers`), flows across a boundary with no encryption, weak
  authentication or a static key (`no-encryption`, `weak-authentication`, `api-key-over-internet`), personal data with
  no encryption (`personal-data-unencrypted`), retries with no idempotency and real-time flows with no retry
  (`retry-without-idempotency`, `missing-retry`), scheduled flows with no interval (`missing-interval`), flows with no
  error handling, monitoring or owner (`missing-error-handling`, `missing-monitoring`, `missing-owner`), and systems
  connected directly to too many others (`point-to-point-sprawl`); and three rules of input problems that cannot be
  lowered (`invalid-record`, `unreadable-file`, `unparsable-file`).
- A summary per system (location, flows out and in, hybrid flows, direct connections) and per pattern.
- A configuration file in strict JSON over documented defaults: the level of every rule, `maxDirectConnections`,
  aliases for locations and patterns, the minimum severity and the level that fails the run; a key the tool does not
  know is an error with its line and a suggestion, and a key named twice is refused.
- Reports as text, JSON, a CSV finding list (`--format csv`) and GitHub workflow commands (`--format github`) that show
  each finding as an annotation; `--min-severity`, `--fail-on`, `--explain` with the rule and the sources of each
  finding, and `--print-defaults`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is, `2`
  for a usage or input error, with no result.
- Reads no clock, follows no symbolic link, connects to nothing, runs nothing, writes nothing to disk, reports binary,
  UTF-16 and invalid UTF-8 input as errors, neutralizes formulas in the CSV finding list, and has a size limit on every
  input.
- A check of the files, not a certification: every report says so.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
