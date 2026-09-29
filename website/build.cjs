const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

// POINT_TO_STEAM and the browser landing were removed in the desktop refactor.
// Hosting is now promotional only: never copy client/dist or boot the game here.
const output = path.join(__dirname, 'dist');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
assert(!/<script|<form|\son\w+\s*=|\/game\/|\/play["']|firebase|socket\.io|bundle\.js/i.test(html), 'The website must not start the browser game');
assert(html.includes('https://store.steampowered.com/app/3729580/Legion/'));
assert(html.includes('https://dikaryon.itch.io/legion'));
fs.mkdirSync(path.join(output, 'assets'), {recursive: true});
for (const file of ['index.html', 'style.css']) fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
const assets = ['logo.png', 'steam.png', 'warrior.png', 'blackmage.png', 'whitemage.png', 'kim.otf', 'favicon.ico'];
for (const asset of assets) {
  fs.copyFileSync(path.join(__dirname, '../client/public', asset), path.join(output, 'assets', asset));
}
assert.deepEqual(fs.readdirSync(output).sort(), ['assets', 'index.html', 'style.css']);
assert.deepEqual(fs.readdirSync(path.join(output, 'assets')).sort(), assets.sort());
console.log('Built standalone promotional website (no game bundle, auth, telemetry or backend requests)');
