// Real packaged renderer/media/context + local Sentry ingestion; simulate OS interruption at the audio boundary.
const assert = require('node:assert/strict');
module.exports = async ({win, js, waitFor, envelopes, url}) => {
  await win.loadURL(url);
  await waitFor('Boolean(document.querySelector(".title-screen-button--play"))');
  // Inject a transient platform failure beneath production recovery, before its context is constructed.
  await js(`
    window.failAudioResume = false;
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () {
      return failAudioResume ? Promise.reject(new DOMException('private-device-details', 'NotReadableError')) : resume.call(this);
    };
    document.querySelector('.title-screen-button--play').click();
  `);
  await waitFor('Boolean(document.querySelector("[data-playmode=casual]"))');
  await js('document.querySelector("[data-playmode=casual]").click()');
  await waitFor('Boolean(window.queueCheck)');
  await js('queueCheck.socket.emit("matchFound", {gameId: "guide-local"})');
  await waitFor('Boolean(window.combatCheck?.arena.gameInitialized)');
  await js(`(async () => {
    window.audioForeground = true;
    Object.defineProperty(document, 'hidden', {configurable: true, get: () => !audioForeground});
    document.hasFocus = () => audioForeground;
    window.audioSignal = () => window.dispatchEvent(new CustomEvent('legion:desktop-action', {detail: {action: 'audio-check', source: 'gamepad'}}));
    window.combatContext = combatCheck.arena.sound.context;
    // Emulate one platform resume failure without replacing Phaser or the audio graph.
    failAudioResume = true;
    await combatContext.suspend();
  })()`);
  await waitFor(() => envelopes.some(body => body.includes('"audio.operation":"resume"')));
  await js('audioSignal()');
  await new Promise(resolve => setTimeout(resolve, 150));
  await js('failAudioResume = false; combatCheck.arena.sound.locked = true; audioSignal()');
  await waitFor('combatContext.state === "running" && !combatCheck.arena.sound.locked');
  await js('(async () => {audioForeground = false; combatCheck.arena.game.events.emit("blur"); await combatContext.suspend(); audioSignal();})()');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await js('combatContext.state'), 'suspended', 'Background controller polling must not resume combat');
  await js('audioForeground = true; combatCheck.arena.game.events.emit("focus"); window.dispatchEvent(new Event("focus"))');
  await waitFor('combatContext.state === "running"');

  // Capture the actual hearth context created by the Play route.
  await js(`
    window.hearthContexts = [];
    window.AudioContext = new Proxy(AudioContext, {construct(Target, args) {
      const context = Reflect.construct(Target, args); hearthContexts.push(context); return context;
    }});
    combatCheck.route('/play');
  `);
  await waitFor('hearthContexts.length > 0 && routeAudio.some(audio => audio.loop && !audio.paused)');
  await waitFor('hearthContexts[0].state === "running"');
  await js('window.menuTrack = routeAudio.filter(audio => audio.loop).at(-1)');
  for (const signal of ['window.dispatchEvent(new Event("focus"))', 'document.dispatchEvent(new Event("visibilitychange"))', 'audioSignal()']) {
    await js(`(async () => {audioForeground = false; menuTrack.pause(); await hearthContexts[0].suspend(); audioForeground = true; ${signal};})()`);
    await waitFor('!menuTrack.paused && hearthContexts[0].state === "running"');
  }
  await js('audioForeground = false; menuTrack.pause(); audioSignal()');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert(await js('menuTrack.paused'), 'Background controller polling must not resume menu music');
  await js(`
    audioForeground = true;
    window.savedAudioSettings = localStorage.getItem('gameSettings');
    localStorage.setItem('gameSettings', JSON.stringify({musicVolume: 37, sfxVolume: 29, musicMuted: true, sfxMuted: true}));
    combatCheck.events.emit('settingsChanged');
    audioSignal();
  `);
  await waitFor('!menuTrack.paused');
  assert.equal(await js('menuTrack.volume'), 0, 'Recovery must respect music mute');
  assert.deepEqual(await js('JSON.parse(localStorage.getItem("gameSettings"))'), {musicVolume: 37, sfxVolume: 29, musicMuted: true, sfxMuted: true});
  await js(`localStorage.setItem('gameSettings', JSON.stringify({musicVolume: 37, sfxVolume: 29, musicMuted: false, sfxMuted: false})); combatCheck.events.emit('settingsChanged')`);
  await waitFor('menuTrack.volume === 0.37');

  await js(`
    window.menuPlay = menuTrack.play.bind(menuTrack);
    menuTrack.pause();
    menuTrack.play = () => Promise.reject(new DOMException('private-device-details', 'NotReadableError'));
    audioSignal();
  `);
  await waitFor(() => envelopes.some(body => body.includes('"audio.source":"route-music"')));
  await js('audioSignal()');
  await new Promise(resolve => setTimeout(resolve, 150));
  await js('menuTrack.play = menuPlay; audioSignal()');
  await waitFor('!menuTrack.paused');
  await js('combatCheck.route("/game/guide-local")');
  await waitFor('Boolean(combatCheck.arena.gameInitialized) && hearthContexts[0].state === "closed" && !menuTrack.getAttribute("src")');
  await js('audioSignal()');
  assert(await js('menuTrack.paused && !menuTrack.getAttribute("src")'), 'Disposed route audio must not restart');
  const reports = envelopes.flatMap(body => body.split('\n').flatMap(line => {
    try { const event = JSON.parse(line); return event.contexts?.audio ? [event] : []; } catch { return []; }
  }));
  assert.equal(reports.length, 2, 'One warning per source/failure, no normal-close warning');
  for (const report of reports) {
    assert.equal(report.level, 'warning');
    assert.equal(report.contexts.audio.reason, 'NotReadableError');
    assert.equal(typeof report.contexts.audio.musicMuted, 'boolean');
    assert(!JSON.stringify(report).includes('private-device-details'), 'Never include raw device errors');
  }
  await js(`savedAudioSettings === null ? localStorage.removeItem('gameSettings') : localStorage.setItem('gameSettings', savedAudioSettings)`);
  console.log('Audio recovery: real menu/hearth/combat resume, foreground/controller gating, mute preservation, teardown and deduplicated local Sentry warnings pass');
};
