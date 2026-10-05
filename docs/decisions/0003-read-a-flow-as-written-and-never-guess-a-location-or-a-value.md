# 3. Read a flow as written, and never guess a location or a value

## Status

Accepted

## Context

An inventory of flows is written by many teams. One writes `On-Prem`, another `on premises`, a third `head office`;
one writes the authentication as `OAuth 2.0`, another as `client credentials`, a third as `magic link`. Systems are
spelled two ways (`order-hub`, `order-hbu`), and some cells hold a dash, `n/a` or `tbd`. Some files are exported from a
sheet, saved as UTF-16 or cut short.

A checker could refuse every value that is not written the one right way, which turns a real inventory into a wall of
errors. It could guess, and read `order-hbu` as `order-hub` or `magic link` as some authentication, which makes an
inventory look in order when nobody decided what a value means. It could skip a row it cannot read. Each of these
makes a run pass, or fail, for a reason nobody can see in the files.

## Decision

1. src/vocabulary.js holds the words the tool reads for each field, with their other names, as a documented data file.
   Names are compared in their term form, so case, spaces, hyphens and underscores never matter.
2. A value that is none of the names is reported (`unknown-location`, `unknown-pattern`, `unknown-value`,
   `unknown-system`), with a near name suggested where one is close; the suggestion is never used. The flow is still
   checked on its other fields, so a typo in one column cannot hide a problem in another.
3. An empty value is never read as a safe one. An empty encryption is reported on a flow that crosses a boundary as no
   encryption stated, and an empty authentication as no authentication stated. The one empty value the tool reads is
   the direction, which is read as one-way, from the source to the target, as the two columns say.
4. A retry policy, an idempotency method and an owner are free text: any text counts, and only an empty value or a
   word for none is reported. The tool cannot tell whether a policy works.
5. A record that cannot be read (no source or target, the wrong number of fields) is an `invalid-record` finding, and a
   file that cannot be read or parsed is an `unreadable-file` or `unparsable-file` finding. These three rules are always
   errors and have no key in the configuration, so a run never passes because a part of the input was passed over. A
   column or key the tool does not read is named in a note.

## Consequences

- A team adds its own words for locations and patterns with `locationAliases` and `patternAliases`, in a reviewed
  commit, instead of the tool learning them by guess.
- A typo is one finding with a suggestion, fixed in one cell.
- A finding is something a reader can check in one cell of a file.
