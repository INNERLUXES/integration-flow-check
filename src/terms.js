// The values of a flow, read from their text: the location, the pattern, the direction, the trigger and its interval,
// the authentication, the yes or no of the encryption, the monitoring and the personal data flag, the error handling,
// and whether a retry policy or an idempotency method is named. Every pattern here is fixed and anchored; none is built
// from the input.

import { AUTHENTICATIONS, DIRECTIONS, ENCRYPTED, ERROR_HANDLING, INTERVAL_UNITS, INTERVAL_WORDS, LOCATIONS, MONITORED, NO, NONE_WORDS, PATTERNS, TRIGGERS, UNENCRYPTED, UNMONITORED, YES, namesOf } from './vocabulary.js';
import { asciiLower, termForm } from './words.js';

export const LOCATION_NAMES = namesOf(LOCATIONS);
export const PATTERN_NAMES = namesOf(PATTERNS);
export const DIRECTION_NAMES = namesOf(DIRECTIONS);
export const TRIGGER_NAMES = namesOf(TRIGGERS);
export const AUTHENTICATION_NAMES = namesOf(AUTHENTICATIONS);
export const ERROR_HANDLING_NAMES = namesOf(ERROR_HANDLING);

// The entry of a list a name stands for, under the aliases of the configuration (term form to the name of an entry), or
// null.
function lookUp(names, text, aliases = {}) {
  const form = termForm(text);
  if (names.has(form)) return names.get(form);
  if (Object.hasOwn(aliases, form)) return names.get(termForm(aliases[form])) ?? null;
  return null;
}

// The location a name stands for: cloud, on-premise or saas, or null.
export const locationOf = (text, aliases = {}) => lookUp(LOCATION_NAMES, text, aliases)?.name ?? null;

// The pattern a name stands for: { name, hub }, or null.
export const patternOf = (text, aliases = {}) => lookUp(PATTERN_NAMES, text, aliases);

// The direction a name stands for: one-way or two-way, or null.
export const directionOf = (text) => lookUp(DIRECTION_NAMES, text)?.name ?? null;

// The authentication a name stands for: { name, strength }, or null.
export const authenticationOf = (text) => lookUp(AUTHENTICATION_NAMES, text);

const UNITS = new Set(INTERVAL_UNITS);
const AMOUNT = /^(?:every[ \t]+)?(\d{1,6}(?:\.\d{1,6})?)[ \t]*([A-Za-z]{1,8})$/i;
const CRON_FIELD = /^[0-9*\/,?-]{1,40}$/;

// True when a text names an interval the tool reads: a number above zero with a unit of time (15 min, every 2 h), a
// word such as hourly or nightly, or a cron expression of five or six fields.
export function isInterval(text) {
  const value = String(text).trim();
  if (value.length > 200) return false;
  const m = AMOUNT.exec(value);
  if (m) return Number(m[1]) > 0 && UNITS.has(asciiLower(m[2]));
  if (INTERVAL_WORDS.includes(termForm(value))) return true;
  const fields = value.split(/[ \t]+/);
  return (fields.length === 5 || fields.length === 6) && fields.every((f) => CRON_FIELD.test(f)) && fields.some((f) => /\d/.test(f));
}

// The trigger of a flow: { name, interval } where name is real-time or scheduled, and interval is the text of an
// interval written with the trigger (scheduled every 15 min, hourly, or an interval alone), or ''. null when the text
// is neither.
export function triggerOf(text) {
  const value = String(text).trim();
  const whole = lookUp(TRIGGER_NAMES, value);
  if (whole) return { name: whole.name, interval: whole.name === 'scheduled' && INTERVAL_WORDS.includes(termForm(value)) ? value : '' };
  if (isInterval(value)) return { name: 'scheduled', interval: value };
  const space = value.search(/[ \t]/);
  if (space > 0) {
    const first = lookUp(TRIGGER_NAMES, value.slice(0, space));
    const word = value.slice(0, space);
    // A word that is an interval itself, such as daily in "daily at night", is the interval.
    if (first && first.name === 'scheduled') return { name: 'scheduled', interval: INTERVAL_WORDS.includes(termForm(word)) ? word : value.slice(space).trim() };
  }
  return null;
}

// Yes or no for a flag: true, false or null when the text is neither. extraYes and extraNo add words of the field.
export function yesNo(text, extraYes = [], extraNo = []) {
  const form = termForm(text);
  if (YES.includes(form) || extraYes.includes(form)) return true;
  if (NO.includes(form) || extraNo.includes(form)) return false;
  return null;
}

// Whether the transport is encrypted: true, false, or null when the text is neither. "TLS 1.2" and "TLS1.3" are yes.
export const encryptionOf = (text) => (/^tls ?\d/.test(termForm(text)) ? true : yesNo(text, ENCRYPTED, UNENCRYPTED));

// Whether the flow is monitored: true, false, or null when the text is neither.
export const monitoringOf = (text) => yesNo(text, MONITORED, UNMONITORED);

// True when a retry policy or an idempotency method says there is none.
export const isNone = (text) => NONE_WORDS.includes(termForm(text));

// The error handling of a flow: { names, unknown } where names are the known ways it names (dead-letter, alert, none)
// and unknown the parts it does not know. Several ways are separated by +, ; or /.
export function errorHandlingOf(text) {
  const names = [];
  const unknown = [];
  for (const part of String(text).split(/[+;/]/).slice(0, 20)) {
    if (termForm(part) === '') continue;
    const e = lookUp(ERROR_HANDLING_NAMES, part);
    if (e === null) unknown.push(part.trim());
    else if (!names.includes(e.name)) names.push(e.name);
  }
  return { names, unknown };
}
