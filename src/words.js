// Words compared as the tool compares them: the letters A to Z lowered whatever the locale. Used for the names of
// files, the columns of a CSV header, the keys of a JSON record, the systems, the data, the locations, the patterns
// and the other values of a flow, and the suggestions of the configuration.

// Lowercase for the letters A to Z only, so the result does not depend on the locale.
export const asciiLower = (text) => String(text).replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

// The last part of a path with forward slashes: "a/b/flows.csv" is "flows.csv".
export const baseName = (path) => String(path).slice(String(path).lastIndexOf('/') + 1);

// The form a name is compared in: the letters A to Z lowered, and every run of characters that are not a letter A to Z
// or a digit made one space, trimmed. "On-Premise" is "on premise", "Order Service" is "order service" and
// "dead_letter" is "dead letter".
export const termForm = (text) => asciiLower(text).replace(/[^a-z0-9]+/g, ' ').trim();

// The form the name of a column or of a key is compared in: the letters A to Z lowered, with white space, hyphens and
// underscores taken out. "Source-System", "source_system" and "sourceSystem" are all "sourcesystem".
export const fieldForm = (text) => asciiLower(text).replace(/[\s_-]+/g, '');

// Values that stand for nothing: an empty text, a dash, a question mark and the words people write for a blank cell.
// They are compared in their term form.
export const BLANK_WORDS = ['', 'n a', 'na', 'nil', 'tbd', 'tbc', 'todo', 'to do', 'unknown', 'not known', 'not set'];

// True when a value says nothing: empty, or one of the blank words.
export const isBlank = (text) => BLANK_WORDS.includes(termForm(text));
