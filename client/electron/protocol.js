const path = require("node:path");

function resolveAppPath(distPath, requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== "app:" || url.hostname !== "legion") throw new Error("Invalid app URL");
  const rawPath = decodeURIComponent(requestUrl.replace(/^app:\/\/legion/i, "").split(/[?#]/)[0]);
  if (rawPath.split("/").includes("..")) throw new Error("Invalid app path");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(distPath, relativePath);
  if (resolved !== distPath && !resolved.startsWith(`${distPath}${path.sep}`)) {
    throw new Error("Invalid app path");
  }
  return resolved;
}

module.exports = {resolveAppPath};
