function isTrustedSender(url, isDev = false) {
  if (isDev) return url.startsWith("http://localhost:8080/");
  return url.startsWith("app://legion/");
}

function isSafeExternalURL(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// The npm LogRocket loader downloads its recorder from this exact origin and uses a blob worker.
// Share the policy with the packaged-route smoke test; never disable CSP to make telemetry work.
const PACKAGED_CSP = "default-src 'self'; script-src 'self' https://cdn.lrkt-in.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https: wss:; font-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'self'";

module.exports = {PACKAGED_CSP, isTrustedSender, isSafeExternalURL};
