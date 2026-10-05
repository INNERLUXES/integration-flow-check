# Brackenfold Freight: a messy hybrid inventory

A made-up freight company in the middle of a move to the cloud. `flows.csv` holds the integration flows its teams wrote
into a shared sheet, and `systems.json` the systems it knows, each with its location. The files hold one problem of
each kind:

- a two-way customer sync between the on-premise ledger and the SaaS CRM with no data owner, basic authentication and
  retries with no idempotency key, and a pair of employee flows that write the same data into each other with two
  different data owners;
- a hybrid file transfer that is not encrypted, is not monitored and is scheduled with no interval, and a nightly
  batch of personal data that states no encryption;
- a SaaS-to-cloud flow that authenticates with a static API key, and a real-time booking flow with no retry policy;
- the order flow written twice under one id, a pattern written as rest-ish, a target written as order-hbu, a data lake
  placed on-premise against the systems file, an authentication written as magic link, a trigger written as whenever,
  a row with no target, a system placed in a private cloud, and a label flow with no error handling and no owner;
- an order hub connected directly to five other systems, more than the four that `../config.json` allows.

The files also hold what must not be reported: two on-premise systems that talk with no authentication and no
encryption inside the site, the location head office and the pattern edi, which the configuration names, the words
hourly, nightly and daily and a cron expression as intervals, event flows, which go through a hub, and flows in good
order.

```
node bin/integration-flow-check.js examples/messy/flows.csv --systems examples/messy/systems.json --config examples/config.json
```
