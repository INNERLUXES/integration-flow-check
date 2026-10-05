// The public pages the checks rest on, and what each says, written in this project's own words. research/sources.md
// lists every page with a longer note on each, and test/data.test.js checks that every page here is listed there and
// that every rule names points that exist. The code in src/ uses these constants and never writes a reason of its own
// in a report. The words the tool reads in a flow are in src/vocabulary.js.

const EIP = 'https://www.enterpriseintegrationpatterns.com/patterns/messaging';

export const SOURCES = [
  { id: 'nistPage', title: 'NIST SP 800-145, The NIST Definition of Cloud Computing (NIST CSRC)', url: 'https://csrc.nist.gov/pubs/sp/800/145/final' },
  { id: 'nistText', title: 'NIST SP 800-145, The NIST Definition of Cloud Computing, full text (NIST)', url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf' },
  { id: 'eipMessageChannel', title: 'Message Channel (Enterprise Integration Patterns)', url: `${EIP}/MessageChannel.html` },
  { id: 'eipPointToPoint', title: 'Point-to-Point Channel (Enterprise Integration Patterns)', url: `${EIP}/PointToPointChannel.html` },
  { id: 'eipIdempotentReceiver', title: 'Idempotent Receiver (Enterprise Integration Patterns)', url: `${EIP}/IdempotentReceiver.html` },
  { id: 'eipDeadLetter', title: 'Dead Letter Channel (Enterprise Integration Patterns)', url: `${EIP}/DeadLetterChannel.html` },
  { id: 'eipGuaranteedDelivery', title: 'Guaranteed Delivery (Enterprise Integration Patterns)', url: `${EIP}/GuaranteedMessaging.html` },
  { id: 'rfc4180', title: 'RFC 4180, Common Format and MIME Type for Comma-Separated Values (CSV) Files', url: 'https://www.rfc-editor.org/rfc/rfc4180' },
  { id: 'rfc8259', title: 'RFC 8259, The JSON Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
  { id: 'owaspCsv', title: 'CSV Injection (OWASP)', url: 'https://community.owasp.org/attacks/CSV_Injection' },
  { id: 'githubCommands', title: 'Workflow commands for GitHub Actions (GitHub Docs)', url: 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// What a page says, in this project's own words. Each point names its page.
export const POINTS = {
  cloudModel: { source: 'nistPage', text: 'cloud computing gives network access on demand to a shared pool of configurable resources, and the definition sets it out in essential characteristics, three service models and four deployment models' },
  deploymentModels: { source: 'nistPage', text: 'the four deployment models are private, community, public and hybrid' },
  hybridCloud: { source: 'nistText', text: 'a hybrid cloud is two or more distinct cloud infrastructures that stay separate entities but are bound together by technology that lets data and applications move between them' },
  privatePremises: { source: 'nistText', text: 'a private cloud serves one organization and may sit on or off its premises, while a public cloud sits on the premises of the provider' },
  saasModel: { source: 'nistText', text: 'in software as a service the consumer uses applications the provider runs on its own infrastructure, and controls neither the infrastructure nor, beyond some settings, the application' },
  broadNetworkAccess: { source: 'nistText', text: 'cloud capabilities are reached over the network through standard mechanisms, from many kinds of client' },
  messageChannel: { source: 'eipMessageChannel', text: 'applications are connected through a channel: one writes to it and another reads from it, and the sender need not know which application receives' },
  pointToPoint: { source: 'eipPointToPoint', text: 'a point-to-point channel makes sure that only one receiver consumes a given message, even when several receivers listen' },
  idempotentReceiver: { source: 'eipIdempotentReceiver', text: 'a receiver can get the same message more than once even when it was sent once, so it either removes duplicates or is built so a repeated message does no harm' },
  deadLetter: { source: 'eipDeadLetter', text: 'a message that the messaging system cannot or should not deliver may be moved to a dead letter channel instead of being lost' },
  guaranteedDelivery: { source: 'eipGuaranteedDelivery', text: 'a message is kept in a store at each step and not removed until the next store holds it, so a failure on the way does not lose it' },
  csvRecords: { source: 'rfc4180', text: 'each record of a CSV file is on its own line, ended by CRLF, the first line may be a header, and a field that holds a comma, a double quote or a line break is put in double quotes, with a double quote inside it written twice' },
  csvSameFields: { source: 'rfc4180', text: 'every line of a CSV file should hold the same number of fields' },
  csvInjection: { source: 'owaspCsv', text: 'a spreadsheet may read a cell that starts with =, +, -, @, a tab or a line break as a formula, and no one escape is safe in every program that opens the file' },
  jsonUtf8: { source: 'rfc8259', text: 'JSON text exchanged between systems must be UTF-8, and a reader may ignore a byte order mark at the start' },
  jsonRepeatedNames: { source: 'rfc8259', text: 'when an object repeats a name the behavior of the software that reads it cannot be predicted, so the reader of this tool refuses a repeated name' },
  githubAnnotations: { source: 'githubCommands', text: 'a line of output such as ::warning file=...,line=...::message becomes an annotation on that file and line in the run' }
};

// The page of a point.
export const pointPage = (key) => source(POINTS[key].source);

// The levels of a finding, from the lowest.
export const LEVELS = ['info', 'warning', 'error'];

// The sentence every report ends with, before the result.
export const NOTICE = 'This check reads the flow inventory as it is written. It connects to no system, tests no connection or credential, and does not certify that an integration is secure, correct or compliant (docs/limits.md).';
