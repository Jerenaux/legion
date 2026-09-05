// Test setup file
// Set environment variables for testing
process.env.NODE_ENV = "test";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
