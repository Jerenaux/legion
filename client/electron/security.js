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

module.exports = {isTrustedSender, isSafeExternalURL};
