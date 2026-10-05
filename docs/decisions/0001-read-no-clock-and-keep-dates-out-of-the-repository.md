# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A check of an integration inventory is tempting to tie to the calendar: a credential that expires on a day, a flow
that must be moved before a migration wave, a scheduled run that is late because the last run was hours ago. Each of
these would make the same files give a different result on a different day, so a pipeline that passed yesterday could
fail today with no change to the repository, and two people checking the same commit could see two reports. The output
could never be saved and compared.

The checks do not need a date. Whether a flow names its ends, a pattern, an owner and a way to handle errors, whether a
hybrid flow is encrypted and authenticated, and whether two flows write the same data into each other can all be read
from the files as they are. Whether a run was late is a question for the monitoring of the flow, not for its inventory.

## Decision

1. The tool reads no clock, no time zone and no locale. The same flows, systems and configuration give the same output
   on every machine and on every day.
2. The interval of a scheduled flow is a text that names how often it runs (every 15 min, hourly, a cron expression).
   The tool checks that it is there and that it can be read; it never compares it with the time of day. The flows, the
   systems and the configuration have no key or column that holds a date.
3. No file of this repository holds a date or a number that reads like a year: not the licence, not the changelog, not
   the examples, not the documents, not the comments of the code. `npm run check` and a test fail on any number that
   reads like a year. Version numbers such as Node 22, RFC 4180 or 1.0.0 and the numbers of publications such as NIST
   SP 800-145 are not years and are fine; the years of their editions are left out, and so are web addresses that hold
   one.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it
  does not move with the calendar.
- The NIST definition is named by its number and its pages, never by the year it was published. A reader checks the
  current page.
- The example values are chosen so that no id, interval or count reads like a year.
