const path = require("node:path");
const {PACKAGED_APP_URL, resolveAppPath} = require("../protocol");
const {isSafeExternalURL, isTrustedSender} = require("../security");

test("keeps app protocol paths inside dist", () => {
  const dist = path.resolve("dist");
  expect(resolveAppPath(dist, "app://legion/bundle.js")).toBe(path.join(dist, "bundle.js"));
  expect(() => resolveAppPath(dist, "app://legion/%2e%2e/secrets.txt")).toThrow("Invalid app path");
});

test("starts the packaged renderer at the root route", () => {
  const dist = path.resolve("dist");
  expect(new URL(PACKAGED_APP_URL).pathname).toBe("/");
  expect(resolveAppPath(dist, PACKAGED_APP_URL)).toBe(path.join(dist, "index.html"));
});

test("accepts only the packaged app as an IPC sender", () => {
  expect(isTrustedSender("app://legion/index.html")).toBe(true);
  expect(isTrustedSender("https://evil.example/")).toBe(false);
  expect(isTrustedSender("http://localhost:8080/", true)).toBe(true);
});

test("opens only HTTPS links externally", () => {
  expect(isSafeExternalURL("https://guide.play-legion.io/")).toBe(true);
  expect(isSafeExternalURL("javascript:alert(1)")).toBe(false);
});
