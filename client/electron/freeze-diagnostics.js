const Sentry = require('@sentry/electron/main');
const {BrowserWindow, powerMonitor} = require('electron');

// Keep a bounded, non-identifying snapshot on the scope. The ANR worker can read
// it while the main thread is blocked; collecting it only in beforeSend is too late.
function installFreezeDiagnostics(app) {
  let lastTick = Date.now();
  let lastPowerEvent = 'started';
  let lastPowerEventAt = lastTick;
  let suspended = false;
  let locked = false;
  let recentDelays = [];
  let resumeTimer;
  const sample = () => {
    const now = Date.now();
    const delay = Math.max(0, now - lastTick - 5000);
    recentDelays = [...recentDelays, Math.round(delay)].slice(-6);
    lastTick = now;
    const windows = BrowserWindow.getAllWindows().filter(window => !window.isDestroyed());
    const memory = process.memoryUsage();
    const metrics = app.getAppMetrics();
    Sentry.setContext('desktop_health', {
      sampled_at: new Date(now).toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      power_event: lastPowerEvent,
      power_event_at: new Date(lastPowerEventAt).toISOString(),
      suspended, locked,
      recent_timer_delays_ms: recentDelays,
      main_rss_mb: Math.round(memory.rss / 1048576),
      main_heap_mb: Math.round(memory.heapUsed / 1048576),
      processes: metrics.slice(0, 12).map(metric => ({
        type: metric.type, cpu_percent: Math.round(metric.cpu.percentCPUUsage),
        working_set_mb: Math.round(metric.memory.workingSetSize / 1024),
      })),
      windows: windows.slice(0, 4).map(window => ({
        visible: window.isVisible(), focused: window.isFocused(), minimized: window.isMinimized(),
        renderer_crashed: !window.webContents.isDestroyed() && window.webContents.isCrashed(),
      })),
    });
  };
  const listeners = ['suspend', 'resume', 'lock-screen', 'unlock-screen'].map(event => {
    const listener = () => {
      lastPowerEvent = event;
      lastPowerEventAt = Date.now();
      if (event === 'suspend') suspended = true;
      if (event === 'resume') suspended = false;
      if (event === 'lock-screen') locked = true;
      if (event === 'unlock-screen') locked = false;
      const watchdog = Sentry.getClient()?.getIntegrationByName('Anr');
      clearTimeout(resumeTimer);
      if (suspended || locked) watchdog?.stopWorker();
      // stopWorker completes asynchronously. Let it settle and the OS wake before rearming.
      else resumeTimer = setTimeout(() => watchdog?.startWorker(), 1000);
      Sentry.addBreadcrumb({category: 'desktop.power', message: event, level: 'info'});
      sample();
    };
    powerMonitor.on(event, listener);
    return [event, listener];
  });
  sample();
  const timer = setInterval(sample, 5000);
  timer.unref();
  app.once('will-quit', () => {
    clearInterval(timer);
    clearTimeout(resumeTimer);
    for (const [event, listener] of listeners) powerMonitor.removeListener(event, listener);
  });
}

module.exports = {installFreezeDiagnostics};
