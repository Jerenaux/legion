// Public ingestion key, never the source-map upload token.
const dsn = 'https://c3c72f4dedb26b85b58c0eb82feea9c1@o4508024644567040.ingest.de.sentry.io/4508024650268752';
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
