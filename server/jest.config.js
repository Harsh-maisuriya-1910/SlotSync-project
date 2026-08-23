export default {
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],

  testMatch: ["**/*.test.js"],

  moduleFileExtensions: ["js", "json"],

  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
  ],

  coverageDirectory: "coverage",

  clearMocks: true,

  verbose: true,
};
