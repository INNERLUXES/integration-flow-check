# 2. Decide whether a flow is hybrid from the locations of its two ends

## Status

Accepted

## Context

Most of the rules of this tool depend on where a flow runs. A file transfer between two servers in one data center is
a different risk from the same transfer between the data center and the cloud, and an API call between two services
of one cloud is different from a call to a SaaS application. Inventories say this in many ways: a column per end, a
column for the whole flow (hybrid, internal, external), a tag such as cloud-to-ground, or nothing at all, because the
location of each system is written on another sheet.

The NIST definition of cloud computing names four deployment models, hybrid among them, and describes a hybrid cloud
as distinct infrastructures bound by technology that lets data move between them. It also says a private cloud may be
on or off the premises, so a name such as private cloud does not say where a system runs.

## Decision

1. Each system has one location: `cloud`, `on-premise` or `saas`. A flow reads the location of each end from its own
   column, or, when that is empty, from the systems file. A flow never says it is hybrid; the tool works it out.
2. A flow is hybrid when one end is on-premise and the other is in the cloud or a SaaS application. A flow crosses a
   boundary when it is hybrid or has a SaaS end; a flow between two on-premise systems or two cloud systems does not.
   The rules on encryption and authentication apply to every flow that crosses a boundary; the rule on personal data
   applies to every flow.
3. A system given two locations, by the systems file and a flow or by two flows, is a `location-conflict` finding. The
   location the flow gives is used for that flow, so its other findings stay right for what it says.
4. A location that is empty and not in the systems file, or not one of the three, is an `unknown-location` finding, and
   the flow is not called hybrid: no rule that needs the location runs on it.

## Consequences

- Two cloud services of one provider that talk over a public endpoint are not reported; the tool cannot tell a public
  endpoint from a private one, and docs/limits.md says so.
- A team that runs systems in a private cloud writes `cloud` or `on-premise` for each, or adds an alias to the
  configuration, and so decides what the tool cannot know.
- The summary per system and the count of hybrid flows come from the same locations as the findings.
