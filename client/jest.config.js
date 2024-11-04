module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '@legion/shared/(.*)': '<rootDir>/../shared/$1',
    '@assets/(.*)': '<rootDir>/src/assets/$1'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
}; 