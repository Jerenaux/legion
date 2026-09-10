// Public ingestion key, never the source-map upload token.
const dsn = 'https://48a2c455bc08f1a0dff91cc403135b83@o4508024644567040.ingest.de.sentry.io/4512060847947856';
const dataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {request: false, response: false},
  httpBodies: [],
  urlQueryParams: false,
  genAI: {inputs: false, outputs: false},
  stackFrameVariables: false,
};

module.exports = {dsn, dataCollection};
