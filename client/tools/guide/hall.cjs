const assert = require('node:assert/strict');

// Real DOM input, media playback and Phaser animations; the account/API are local fixtures.
module.exports = async ({win, js, waitFor, ready, url}) => {
  win.setContentSize(1280, 720);
  await win.loadURL(url);
  await js("localStorage.setItem('displayed_popups', JSON.stringify(Array.from({length:100}, (_, i) => i)))");
  for (const state of ['key', 'countdown', 'stale']) {
    await win.loadURL(`${url}play?chest=${state}`);
    await waitFor('Boolean(document.querySelector(".lootBoxContainer"))');
    await ready();
    const point = await js(`(() => {
      const box = document.querySelector('.loot-box-footer').getBoundingClientRect();
      return {x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2)};
    })()`);
    win.webContents.sendInputEvent({type: 'mouseMove', ...point});
    await js('document.querySelector(".lootBoxContainer").focus()');
    await waitFor('Boolean(document.querySelector("[role=tooltip]"))');
    const soundsBefore = await js('routeAudio.filter(audio => !audio.loop).length');
    win.webContents.sendInputEvent({type: 'mouseDown', button: 'left', clickCount: 1, ...point});
    win.webContents.sendInputEvent({type: 'mouseUp', button: 'left', clickCount: 1, ...point});
    await waitFor(`routeAudio.filter(audio => !audio.loop).length === ${soundsBefore + 1}`);
    assert.equal(await js('chestCheck.claims'), state === 'stale' ? 1 : 0, 'Known locked chests must not call the API; stale claims must recover without a popup');
    assert.equal(await js('Boolean(document.querySelector(".simple-popup, .chest-reveal"))'), false);
    if (state === 'countdown') {
      await waitFor('Boolean(document.querySelector(".loot-box-open"))');
      await js('document.querySelector(".lootBoxContainer").focus()');
      win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Return'});
      win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Return'});
      await waitFor('chestCheck.claims === 1');
      await waitFor('Boolean(document.querySelector(".chest-reward"))');
    }
  }
  await win.loadURL(`${url}game/guide-local`);
  await waitFor('Boolean(window.combatCheck?.arena.gameInitialized)');
  for (const id of [3, 4, 5]) {
    for (const [x, y, zoom] of [[3, 2, 1], [5, 7, 1.5]]) {
      await js(`(() => {
        const arena = combatCheck.arena;
        arena.cameras.main.setZoom(${zoom});
        arena.enqueueMessage('localanimation', {fromX: 4, fromY: 4, toX: ${x}, toY: ${y}, id: ${id}, isKill: false});
      })()`);
      await waitFor(`combatCheck.arena.localAnimationSprite.anims.currentAnim?.key === 'thunder_${id - 2}' && combatCheck.arena.localAnimationSprite.visible && combatCheck.arena.localAnimationSprite.y === combatCheck.arena.hexGridToPixelCoords(${x}, ${y}).y`);
      const positions = await js(`(() => {
        const arena = combatCheck.arena, sprite = arena.localAnimationSprite;
        const target = arena.hexGridToPixelCoords(${x}, ${y});
        const impactY = ${id === 3 ? 256 : 164};
        return {dx: sprite.x - target.x, dy: sprite.y + (impactY - sprite.displayOriginY) * sprite.scaleY - target.y};
      })()`);
      assert(Math.abs(positions.dx) < 1 && Math.abs(positions.dy) < 1, 'Thunder impact must stay on its tile across source frames, positions and zooms');
    }
  }
  console.log('Chest rejection/input, countdown expiry, reward opening and Phaser Thunder impact anchors pass');
};
