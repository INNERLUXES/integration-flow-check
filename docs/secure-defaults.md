# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which files you give it, where the output goes, and who may
change the inventory and the configuration. The tool is a check of the files, not a certification; a passing run is an
inventory in good order, not a finding that the integrations are secure.

## How the tool behaves by default

- **Reads, never follows.** The tool reads the files it is given and the configuration named with `--config`. It
  walks no folder, follows no symbolic link, fetches no web address, refuses an argument that looks like an address,
  connects to none of the systems the inventory names, evaluates nothing, starts no program and writes nothing to disk.
- **Every rule on from the first run.** The problems that make a flow unsafe or its data wrong are errors (an unknown
  system, location, pattern or value, a duplicate flow, conflicting writers, a flow across a boundary with no
  encryption or weak authentication, personal data with no encryption, a retry with no idempotency, a scheduled flow
  with no interval), and the ones that need a decision are warnings (a duplicate id, a static key over the internet, a
  real-time flow with no retry, no error handling, no monitoring, no owner). Point-to-point sprawl is information.
- **Empty is never safe.** An empty encryption or authentication on a flow that crosses a boundary is reported as not
  stated, and an empty location is reported unless the systems file gives one
  ([decision 3](decisions/0003-read-a-flow-as-written-and-never-guess-a-location-or-a-value.md)).
- **Fail closed on what it cannot read.** A file that cannot be read, a file the readers refuse and a record that
  cannot be read are error findings that fail the run at the default `failOn` of `error`; these three rules have no key
  and cannot be lowered or set off. A path that cannot be used stops the run with exit code `2` and no result.
- **No guesses.** An unknown system, location, pattern or value is reported, not matched to a near one; a near name is
  only suggested.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and
  a suggestion, so a typo such as `failOm` cannot leave a default in place. A key named twice stops the run.
- **No regular expression from the input.** No pattern is built from the flows, the systems or the configuration.
- **No prototype tricks.** Objects are built with own properties and names are looked up with `Object.hasOwn` or in
  maps, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names included, has control characters, line separators and direction
  controls removed and its length capped before it reaches a report or an error message. The GitHub format escapes
  `%`, CR and LF in a message and also `:` and `,` in a property, so a text cannot end a workflow command early or
  start another one. The CSV format puts a single quote in front of a field that a spreadsheet could read as a formula.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`"failOn": "warning"`.** Duplicate ids, static keys over the internet, real-time flows with no retry and flows
  with no error handling, monitoring or owner fail the run too. Use it once the errors are fixed.
- **A systems file on every run.** With `--systems`, every system of every flow is checked against the list, and a
  location given in a flow is checked against the location of its system.
- **`"rules": { "pointToPointSprawl": "warning" }`** and a lower `maxDirectConnections`, when the target design routes
  every flow through a hub.
- **Keep the aliases short.** Every alias is a name the check accepts as a location or a pattern. A location alias
  decides whether a flow is hybrid; review each one.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Integration flow check
    run: npx --yes github:INNERLUXES/integration-flow-check integration/flows.csv --systems integration/systems.csv --config integration/check.json --format github
```

- Give the job read access to the contents and nothing more. The tool needs no secret and no network access to your
  systems.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Do not hide the exit code with a trailing `|| true`. To list the findings without failing, keep `failOn` at `error`
  and keep the JSON report or the CSV finding list as an artifact of the job.
- Keep no secret in the inventory. An authentication column names the method, never a key, a password or a token.
- Treat a CSV finding list built from files you do not trust as untrusted data: open it with formulas off.

## Protecting the inventory and the configuration

The inventory and the systems file decide which flows are hybrid and which rules apply to them, and the configuration
decides which rules report, which names are aliases and what fails the run. Keep all three in the repository, put
their paths in `CODEOWNERS` with the people who own the integration architecture, and require their review in branch
protection. Review a change that empties a location, moves a system, sets a rule to off or lower, adds an alias or
raises `failOn` or `maxDirectConnections` like a change to code: each of them can hide a gap.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
