// SDK request filtering does not cover credentials inside console arguments or URL strings.
export function scrubTelemetry<T>(event: T): T {
  return JSON.parse(JSON.stringify(event, (key, value) => {
    if (/^(authorization|cookies?|password|credential|ticket|.*token|api[-_]?key)$/i.test(key)) return '[Filtered]';
    if (typeof value !== 'string') return value;
    return value
      .replace(/\b(?:https?|app):\/\/[^\s"<>]+/g, url => url.split(/[?#]/)[0])
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, '[Filtered]');
  }));
}
