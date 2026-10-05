// The checks: every system of the systems file read, with its location; every flow read, with the locations of its
// ends, its pattern, direction, trigger, authentication, encryption, retry policy, idempotency, error handling,
// monitoring, owner and personal data flag; the findings of the rules; the summary per system and per pattern.
//
// Flows are checked in the order of the files and of the records in each. Systems, data and ids are compared in their
// term form, so "Order Service" and "order-service" are one system. A flow with a value the tool does not know is
// still checked on its other fields, so a typo in one column cannot hide a problem in another.

import { suggestion } from './config.js';
import { listText, plural } from './size.js';
import { authenticationOf, directionOf, encryptionOf, errorHandlingOf, isInterval, isNone, locationOf, monitoringOf, patternOf, triggerOf, yesNo, AUTHENTICATION_NAMES, LOCATION_NAMES, PATTERN_NAMES } from './terms.js';
import { PATTERNS } from './vocabulary.js';
import { isBlank, termForm } from './words.js';

export const FLOW_LIMITS = { maxSuggestions: 100 };

// The place of a field of a record, or of the record itself when the field is not in its file.
const placeOf = (r, field) => r.at[field] ?? { line: r.line, column: r.column };

// Where a location puts a system, as a sentence says it.
export const whereText = (location) => (location === 'on-premise' ? 'on-premise' : location === 'cloud' ? 'in the cloud' : 'in a SaaS application');

// How a flow that crosses a boundary crosses it, as a sentence says it.
export function crossingText(from, to) {
  if ((from === 'on-premise') !== (to === 'on-premise')) return `crosses from ${from} to ${to}, a hybrid flow,`;
  return `runs from ${from} to ${to}, over the internet,`;
}

// What the ends of a flow say about it: { hybrid, crossing }. A flow is hybrid when one end is on-premise and the other
// is not, and crosses a boundary when it is hybrid or has a SaaS end.
export function boundaryOf(from, to) {
  if (from === null || to === null) return { hybrid: false, crossing: false };
  const hybrid = (from === 'on-premise') !== (to === 'on-premise');
  return { hybrid, crossing: hybrid || from === 'saas' || to === 'saas' };
}

// Checks the systems and the flows read: { summary, findings, unsuggested }. Each finding is
// { rule, file, line, column, found, flow, source, target }.
export function checkFlows(flowFiles, systemFiles, config, limits = FLOW_LIMITS) {
  const lim = { ...FLOW_LIMITS, ...limits };
  const findings = [];
  const add = (rule, r, field, found, about = {}) => {
    const p = placeOf(r, field);
    findings.push({ rule, file: r.file, line: p.line, column: p.column, found, flow: about.flow ?? '', source: about.source ?? '', target: about.target ?? '' });
  };
  let suggested = 0;
  let unsuggested = 0;
  // A near name for a name the tool does not know, within the limit of suggestions. names maps a known name in its
  // term form to the name shown, so a near alias suggests the name it stands for.
  const hint = (text, names) => {
    const form = termForm(text);
    if (form.length < 3) return '';
    if (suggested >= lim.maxSuggestions) {
      unsuggested += 1;
      return '';
    }
    suggested += 1;
    const s = suggestion(form, [...names.keys()]);
    return s ? `, did you mean "${names.get(/"(.*)"/.exec(s)[1])}"?` : '';
  };
  const shown = (map, aliases) => new Map([...[...map].map(([k, e]) => [k, e.name]), ...Object.entries(aliases)]);
  const locationNames = shown(LOCATION_NAMES, config.locationAliases);
  const patternNames = shown(PATTERN_NAMES, config.patternAliases);
  const authNames = shown(AUTHENTICATION_NAMES, {});

  // The systems file.
  const systems = new Map();
  for (const s of systemFiles.flatMap((f) => f.records)) {
    const form = termForm(s.name);
    const about = { source: s.name };
    const first = systems.get(form);
    if (first) {
      add('invalid-record', s, 'name', `the system "${s.name}" is listed a second time; the first is at ${first.file}:${first.line}; the record is not checked`, about);
      continue;
    }
    let location = null;
    if (isBlank(s.location)) add('unknown-location', s, 'location', `the system "${s.name}" names no location`, about);
    else {
      location = locationOf(s.location, config.locationAliases);
      if (location === null) add('unknown-location', s, 'location', `the system "${s.name}" has the location "${s.location}", which is not cloud, on-premise or saas${hint(s.location, locationNames)}`, about);
    }
    systems.set(form, { name: s.name, location, file: s.file, line: s.line });
  }
  const listed = systemFiles.some((f) => f.read);
  const systemNames = new Map([...systems].map(([k, s]) => [k, s.name]));

  // The summary per system, the systems of the systems file first.
  const rows = new Map();
  const rowOf = (name, form) => {
    if (!rows.has(form)) rows.set(form, { system: name, location: systems.get(form)?.location ?? null, listed: systems.has(form), out: 0, in: 0, hybrid: 0, partners: new Set(), first: null });
    return rows.get(form);
  };
  for (const [form, s] of systems) rowOf(s.name, form);
  const patternRows = new Map(PATTERNS.map((p) => [p.name, { pattern: p.name, hub: p.hub, flows: 0, hybrid: 0, twoWay: 0 }]));
  const totals = { flows: 0, hybrid: 0, crossing: 0, twoWay: 0, realTime: 0, scheduled: 0, personalData: 0, systems: 0 };

  const stated = new Map();
  const ids = new Map();
  const same = new Map();
  const writes = new Map();
  for (const r of flowFiles.flatMap((f) => f.records)) {
    totals.flows += 1;
    const label = isBlank(r.id) ? `the flow from ${r.source} to ${r.target}` : `the flow "${r.id}"`;
    const about = { flow: isBlank(r.id) ? '' : r.id, source: r.source, target: r.target };
    const flag = (rule, field, found) => add(rule, r, field, found, about);
    const src = termForm(r.source);
    const tgt = termForm(r.target);

    if (!isBlank(r.id)) {
      const first = ids.get(termForm(r.id));
      if (first) flag('duplicate-id', 'id', `${label} has the id of the flow at ${first.file}:${first.line}`);
      else ids.set(termForm(r.id), r);
    }

    if (listed) {
      for (const [field, what] of [['source', 'source'], ['target', 'target'], ['dataOwner', 'data owner']]) {
        if (isBlank(r[field]) || systems.has(termForm(r[field]))) continue;
        flag('unknown-system', field, `${label} names the ${what} "${r[field]}", which the systems file does not list${hint(r[field], systemNames)}`);
      }
    }

    // The location of each end: the flow's own column, else the systems file.
    const locate = (name, form, field, side) => {
      const text = r[field];
      const entry = systems.get(form);
      if (isBlank(text)) {
        if (entry) return entry.location;
        flag('unknown-location', field, `${label} names no location for its ${side} "${name}"${listed ? ', and the systems file does not list it' : ''}`);
        return null;
      }
      const location = locationOf(text, config.locationAliases);
      if (location === null) {
        flag('unknown-location', field, `${label} has the ${side} location "${text}", which is not cloud, on-premise or saas${hint(text, locationNames)}`);
        return null;
      }
      if (entry && entry.location !== null) {
        if (entry.location !== location) flag('location-conflict', field, `${label} puts its ${side} "${name}" ${whereText(location)}, and the systems file at ${entry.file}:${entry.line} puts it ${whereText(entry.location)}`);
      } else if (!entry) {
        const first = stated.get(form);
        if (!first) stated.set(form, { location, file: r.file, line: r.line });
        else if (first.location !== location) flag('location-conflict', field, `${label} puts its ${side} "${name}" ${whereText(location)}, and the flow at ${first.file}:${first.line} puts it ${whereText(first.location)}`);
      }
      return location;
    };
    const from = locate(r.source, src, 'sourceLocation', 'source');
    const to = locate(r.target, tgt, 'targetLocation', 'target');
    const { hybrid, crossing } = boundaryOf(from, to);

    let pattern = null;
    if (isBlank(r.pattern)) flag('unknown-pattern', 'pattern', `${label} names no pattern`);
    else {
      pattern = patternOf(r.pattern, config.patternAliases);
      if (pattern === null) flag('unknown-pattern', 'pattern', `${label} has the pattern "${r.pattern}", which is not one of api, event, file, batch, database or ipaas${hint(r.pattern, patternNames)}`);
    }

    // An empty direction is read as one-way, from the source to the target, as the two columns say.
    let direction = 'one-way';
    if (!isBlank(r.direction)) {
      direction = directionOf(r.direction);
      if (direction === null) flag('unknown-value', 'direction', `${label} has the direction "${r.direction}", which is not one-way or two-way`);
    }

    let trigger = null;
    if (!isBlank(r.trigger)) {
      trigger = triggerOf(r.trigger);
      if (trigger === null) flag('unknown-value', 'trigger', `${label} has the trigger "${r.trigger}", which is not real-time or scheduled`);
    } else if (!isBlank(r.interval)) trigger = { name: 'scheduled', interval: '' };
    if (trigger?.name === 'scheduled') {
      const interval = isBlank(r.interval) ? trigger.interval : r.interval;
      const field = r.at.interval ? 'interval' : 'trigger';
      if (interval === '') flag('missing-interval', field, `${label} is scheduled and names no interval`);
      else if (!isInterval(interval)) flag('missing-interval', field, `${label} is scheduled with the interval "${interval}", which the tool does not read`);
    }

    let auth = null;
    if (!isBlank(r.authentication)) {
      auth = authenticationOf(r.authentication);
      if (auth === null) flag('unknown-value', 'authentication', `${label} has the authentication "${r.authentication}", which the tool does not know${hint(r.authentication, authNames)}`);
    }
    const authKnown = isBlank(r.authentication) || auth !== null;

    let encrypted = null;
    if (!isBlank(r.encryption)) {
      encrypted = encryptionOf(r.encryption);
      if (encrypted === null) flag('unknown-value', 'encryption', `${label} has the encryption "${r.encryption}", which is not yes, no or a transport the tool knows`);
    }
    const encryptionKnown = isBlank(r.encryption) || encrypted !== null;
    const noEncryption = encryptionKnown && encrypted !== true ? (encrypted === false ? 'is not encrypted' : 'states no transport encryption') : '';

    const retries = !isBlank(r.retry) && !isNone(r.retry);
    const idempotent = !isBlank(r.idempotency) && !isNone(r.idempotency);

    const handling = errorHandlingOf(r.errorHandling);
    if (handling.unknown.length) flag('unknown-value', 'errorHandling', `${label} has the error handling ${listText(handling.unknown.map((x) => `"${x}"`), 3)}, which is not dead-letter, alert or none`);
    if (isBlank(r.errorHandling)) flag('missing-error-handling', 'errorHandling', `${label} names no error handling`);
    else if (!handling.unknown.length && handling.names.every((n) => n === 'none')) flag('missing-error-handling', 'errorHandling', `${label} has no error handling`);

    if (isBlank(r.monitoring)) flag('missing-monitoring', 'monitoring', `${label} does not say whether it is monitored`);
    else {
      const monitored = monitoringOf(r.monitoring);
      if (monitored === null) flag('unknown-value', 'monitoring', `${label} has the monitoring "${r.monitoring}", which is not yes or no`);
      else if (!monitored) flag('missing-monitoring', 'monitoring', `${label} is not monitored`);
    }

    if (isBlank(r.owner)) flag('missing-owner', 'owner', `${label} has no owner`);

    let personal = false;
    if (!isBlank(r.personalData)) {
      personal = yesNo(r.personalData);
      if (personal === null) flag('unknown-value', 'personalData', `${label} has the personal data flag "${r.personalData}", which is not yes or no`);
    }

    if (crossing) {
      const how = crossingText(from, to);
      if (noEncryption) flag('no-encryption', 'encryption', `${label} ${how} and ${noEncryption}`);
      if (authKnown && (auth === null || auth.strength === 'none' || auth.strength === 'weak')) flag('weak-authentication', 'authentication', `${label} ${how} and ${auth === null ? 'names no authentication' : auth.strength === 'none' ? 'has no authentication' : 'authenticates with basic, a user name and a password'}`);
      if (auth?.strength === 'key') flag('api-key-over-internet', 'authentication', `${label} ${how} and authenticates with a static key (${auth.name})`);
    }
    if (personal === true && noEncryption) flag('personal-data-unencrypted', 'personalData', `${label} carries personal data${isBlank(r.data) ? '' : ` (${r.data})`} and ${noEncryption}`);
    if (retries && !idempotent) flag('retry-without-idempotency', 'idempotency', `${label} retries (${r.retry}) and names no idempotency key or method, so a repeated delivery can write a record twice`);
    if (trigger?.name === 'real-time' && !retries) flag('missing-retry', 'retry', `${label} is real-time and ${isBlank(r.retry) ? 'names no retry policy' : 'does not retry'}`);

    // The writers of the data.
    const data = termForm(r.data);
    if (direction === 'two-way' && isBlank(r.dataOwner)) flag('conflicting-writers', r.at.dataOwner ? 'dataOwner' : 'direction', `${label} is two-way between ${r.source} and ${r.target} and names no data owner, so both can write ${isBlank(r.data) ? 'the data' : r.data}`);
    if (data !== '' && direction !== null) {
      const key = direction === 'two-way' ? `2\u0000${[src, tgt].sort().join('\u0000')}\u0000${data}` : `1\u0000${src}\u0000${tgt}\u0000${data}`;
      const first = same.get(key);
      if (first) flag('duplicate-flow', 'data', `${label} moves ${r.data} ${direction === 'two-way' ? 'between' : 'from'} ${r.source} ${direction === 'two-way' ? 'and' : 'to'} ${r.target}, as the flow at ${first.file}:${first.line} does`);
      else same.set(key, r);
      if (direction === 'one-way') {
        const back = writes.get(`${tgt}\u0000${src}\u0000${data}`);
        const owner = termForm(r.dataOwner);
        if (back && (owner === '' || owner !== termForm(back.dataOwner))) {
          const why = owner === '' && termForm(back.dataOwner) === '' ? 'and neither names a data owner' : 'and the two do not name one data owner';
          flag('conflicting-writers', 'data', `${label} writes ${r.data} from ${r.source} into ${r.target}, the flow at ${back.file}:${back.line} writes it from ${r.target} into ${r.source}, ${why}`);
        }
        if (!writes.has(`${src}\u0000${tgt}\u0000${data}`)) writes.set(`${src}\u0000${tgt}\u0000${data}`, r);
      }
    }

    // The summary.
    const a = rowOf(r.source, src);
    const b = rowOf(r.target, tgt);
    a.first ??= { r, field: 'source' };
    b.first ??= { r, field: 'target' };
    if (a.location === null && from !== null) a.location = from;
    if (b.location === null && to !== null) b.location = to;
    a.out += 1;
    b.in += 1;
    if (hybrid) {
      a.hybrid += 1;
      if (b !== a) b.hybrid += 1;
      totals.hybrid += 1;
    }
    if (crossing) totals.crossing += 1;
    if (direction === 'two-way') totals.twoWay += 1;
    if (trigger?.name === 'real-time') totals.realTime += 1;
    if (trigger?.name === 'scheduled') totals.scheduled += 1;
    if (personal === true) totals.personalData += 1;
    if (pattern !== null && !pattern.hub && src !== tgt) {
      a.partners.add(tgt);
      b.partners.add(src);
    }
    const key = pattern === null ? 'unknown' : pattern.name;
    if (!patternRows.has(key)) patternRows.set(key, { pattern: key, hub: false, flows: 0, hybrid: 0, twoWay: 0 });
    const p = patternRows.get(key);
    p.flows += 1;
    if (hybrid) p.hybrid += 1;
    if (direction === 'two-way') p.twoWay += 1;
  }

  // Systems connected directly to more than the limit.
  for (const row of rows.values()) {
    if (row.partners.size <= config.maxDirectConnections || row.first === null) continue;
    const names = [...row.partners].map((f) => rows.get(f).system);
    add('point-to-point-sprawl', row.first.r, row.first.field, `the system "${row.system}" is connected directly to ${plural(names.length, 'other system')} (${listText(names, 4)}), more than ${config.maxDirectConnections}; a hub such as an iPaaS or an event bus would connect it once`, { source: row.system });
  }

  const systemRows = [...rows.values()].map((x) => ({ system: x.system, location: x.location ?? '', listed: x.listed, out: x.out, in: x.in, hybrid: x.hybrid, direct: x.partners.size }));
  totals.systems = systemRows.length;
  return { summary: { systems: systemRows, patterns: [...patternRows.values()], totals }, findings, unsuggested };
}
