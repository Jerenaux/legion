const fs = require("node:fs");
const path = require("node:path");

// The player's display mode, kept beside other desktop data so the window can open in it
// directly. Fullscreen until the player chooses otherwise.
const FILE = "display.json";

function readDisplayMode(directory) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(directory, FILE), "utf8"));
    return {fullscreen: saved?.fullscreen !== false};
  } catch {
    return {fullscreen: true};
  }
}

function writeDisplayMode(directory, mode) {
  try {
    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(path.join(directory, FILE), JSON.stringify({fullscreen: Boolean(mode.fullscreen)}));
  } catch {
    // A read-only profile must not break the game; the mode resets to fullscreen next launch.
  }
}

// F11 and Alt+Enter on Windows/Linux, Control+Command+F on macOS. Escape is deliberately
// not a way out: it already closes dialogs and cancels targeting.
function isFullscreenShortcut(input, platform = process.platform) {
  if (input.type !== "keyDown" || input.isAutoRepeat) return false;
  if (platform === "darwin") return Boolean(input.control && input.meta && input.key?.toLowerCase() === "f");
  return input.key === "F11" || Boolean(input.alt && !input.control && !input.meta && input.key === "Enter");
}

// Window options for the saved mode. On macOS, an explicit `fullscreen: false` makes the
// window permanently non-fullscreenable, so fullscreen is requested after showing instead
// and the option is never set there.
function displayWindowOptions(startFullscreen, platform = process.platform) {
  return {fullscreenable: true, ...(startFullscreen && platform !== "darwin" ? {fullscreen: true} : {})};
}

// Shows the window only once it has its final size, so the first frames are not drawn at a
// smaller size and then jump (the loading screen flashing in a corner). macOS can enter
// fullscreen only once the window is shown, so the window stays transparent until then;
// the timeout reveals it even if fullscreen never arrives.
function revealWindow(window, startFullscreen, platform = process.platform, wait = setTimeout) {
  window.maximize();
  if (!startFullscreen || platform !== "darwin" || window.isFullScreen()) {
    window.show();
    return;
  }
  let revealed = false;
  const reveal = () => {
    if (revealed || window.isDestroyed()) return;
    revealed = true;
    window.setOpacity(1);
  };
  window.setOpacity(0);
  // Leave a moment for the page to lay out at the fullscreen size.
  window.once("enter-full-screen", () => wait(reveal, 150));
  wait(reveal, 2500);
  window.show();
  window.setFullScreen(true);
}

module.exports = {revealWindow, readDisplayMode, writeDisplayMode, isFullscreenShortcut, displayWindowOptions};
