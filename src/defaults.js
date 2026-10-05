// The built-in configuration: the level of every rule, the number of systems one system may be connected to directly
// before a hub is suggested, the other names of locations and patterns, the lowest level shown and the level that fails
// the run. docs/inputs.md describes every key, and --print-defaults writes all of this out.

// The level of every rule that the configuration can set. The three rules of input problems are always errors.
export const DEFAULT_RULES = {
  unknownSystem: 'error',
  unknownLocation: 'error',
  locationConflict: 'error',
  unknownPattern: 'error',
  unknownValue: 'error',
  duplicateFlow: 'error',
  duplicateId: 'warning',
  conflictingWriters: 'error',
  noEncryption: 'error',
  weakAuthentication: 'error',
  apiKeyOverInternet: 'warning',
  personalDataUnencrypted: 'error',
  retryWithoutIdempotency: 'error',
  missingRetry: 'warning',
  missingInterval: 'error',
  missingErrorHandling: 'warning',
  missingMonitoring: 'warning',
  missingOwner: 'warning',
  pointToPointSprawl: 'info'
};

// A system connected directly to more than this many other systems gets a point-to-point-sprawl finding.
export const DEFAULT_MAX_DIRECT_CONNECTIONS = 5;

// Other names of locations and of patterns, in the form they are compared in (src/words.js termForm), with the name
// each stands for. None is built in beyond the names of src/vocabulary.js.
export const DEFAULT_LOCATION_ALIASES = {};
export const DEFAULT_PATTERN_ALIASES = {};

// The lowest level of a finding that is shown.
export const DEFAULT_MIN_SEVERITY = 'info';

// The lowest level of a finding that fails the run.
export const DEFAULT_FAIL_ON = 'error';
