# Tallowfen Clinics: an inventory in good order

A made-up group of clinics whose flows pass through one integration hub in the cloud. `flows.json` holds seven flows
between a SaaS patient portal, a scheduling service and billing in the cloud, and a lab system and a records database
on-premise, and `systems.csv` lists the six systems with their locations. Every flow that crosses a boundary is
encrypted and authenticated with OAuth 2.0, mutual TLS or a managed identity, every retry has an idempotency key, every
flow has error handling, monitoring and an owner, and every scheduled flow has an interval. The run passes with no
finding.

```
node bin/integration-flow-check.js examples/clean/flows.json --systems examples/clean/systems.csv
```
