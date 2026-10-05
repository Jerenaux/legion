const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({win, js, waitFor, ready, output, locale, giftQueue}) => {
  // Keep keyboard focus deterministic without stealing focus from other apps.
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', {enabled: true});
  const token = 'a'.repeat(64);
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../../locales', locale, 'messages.json'), 'utf8'));
  const dismiss = () => js('document.querySelector(".gift-actions [data-desktop-cancel]").click()');
  const deliver = () => { giftQueue.add(token); win.webContents.send('gift-available'); };
  await js('localStorage.setItem("displayed_popups", JSON.stringify(Array.from({length:100}, (_, i) => i))); localStorage.setItem("gameSettings", JSON.stringify({textSize:130,musicVolume:0,sfxVolume:0}))');
  for (const [width, height] of [[1280, 720], [800, 600]]) {
    win.setContentSize(width, height);
    giftQueue.add(token);
    await win.loadURL('app://legion/?loading');
    await ready();
    assert.equal(await js('giftCheck.requests'), 0, 'Wait for player initialization');
    await js('titleLoadingCheck.finish()');
    await waitFor('Boolean(document.querySelector(".gift-rewards"))');
    assert.equal(await js('document.querySelector(".gift-dialog h2").textContent'), catalog['Your gear is ready']);
    assert.equal(await js('document.querySelectorAll(".gift-rewards li").length'), 4);
    assert(await js('document.querySelector(".gift-dialog").scrollWidth <= document.querySelector(".gift-dialog").clientWidth'), 'Gift content must not overflow horizontally');
    await ready();
    fs.writeFileSync(path.join(output, `${locale}-gift-${width}.png`), (await win.webContents.capturePage()).toPNG());
    await waitFor('document.hasFocus()');
    for (const [index, name] of ['Ring of the Soul', 'Ice', 'Potion', 'Gold'].entries()) {
      await js(`document.querySelectorAll('.gift-reward')[${index}].focus()`);
      await ready();
      await waitFor(`Boolean(document.querySelector('.gift-dialog .react-tooltip__show .item-preview-name')?.textContent === ${JSON.stringify(catalog[name])})`);
      assert(await js(`(() => {const box=document.querySelector('.gift-dialog .react-tooltip__show').getBoundingClientRect();return box.left>=0 && box.right<=innerWidth && box.top>=0 && box.bottom<=innerHeight})()`), 'Reward hover card must fit the viewport');
      if (index === 0) {
        assert((await js('document.querySelector(".gift-dialog .item-preview").textContent')).includes(catalog['Requires level {{level}}'].replace('{{level}}', '1')));
        fs.writeFileSync(path.join(output, `${locale}-gift-hover-${width}.png`), (await win.webContents.capturePage()).toPNG());
      }
    }
    await js('document.querySelector(".gift-actions button").focus()');
    await ready();
    win.webContents.sendInputEvent({type: 'mouseMove', x: 1, y: 1});
    // Native pointer hover uses the same card as keyboard/controller focus.
    const point = await js('(() => {const b=document.querySelector(".gift-reward").getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+25)}})()');
    win.webContents.sendInputEvent({type: 'mouseMove', ...point});
    await waitFor(`document.querySelector('.gift-dialog .react-tooltip__show .item-preview-name')?.textContent === ${JSON.stringify(catalog['Ring of the Soul'])}`);
    win.webContents.sendInputEvent({type: 'mouseMove', x: 1, y: 1});
    await dismiss(); await waitFor('!document.querySelector(".gift-dialog")');
    assert.equal(giftQueue.peek(), null, 'Successful receipt clears the pending link');
  }
  for (const status of ['already_claimed', 'unavailable', 'error']) {
    await js(`giftCheck.status=${JSON.stringify(status)}`);
    deliver();
    await waitFor('Boolean(document.querySelector(".gift-actions"))');
    if (status === 'error') {
      assert.equal(giftQueue.peek(), token, 'Failed requests must retain the token');
      await js('giftCheck.status="claimed"; document.querySelector(".gift-actions button").click()');
      await waitFor('Boolean(document.querySelector(".gift-rewards"))');
    }
    await dismiss(); await waitFor('!document.querySelector(".gift-dialog")');
  }
  await win.loadURL('app://legion/queue/casual');
  await ready(); deliver(); await ready();
  assert.equal(await js('giftCheck.requests'), 0, 'Do not redeem while queued');
  await win.loadURL('app://legion/');
  await waitFor('Boolean(document.querySelector(".gift-rewards"))');
  await dismiss(); await waitFor('!document.querySelector(".gift-dialog")');
  win.webContents.debugger.detach();
  console.log(`${locale}: gift startup, running-app delivery, retry, duplicate, invalid link, queue deferral and compact layout pass`);
};
