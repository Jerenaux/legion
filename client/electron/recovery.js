const {dialog} = require('electron');

function installRendererRecovery(window, translate = key => key) {
  let prompting = false;
  let restarting = false;
  const recover = async (reason) => {
    if (reason === 'clean-exit' || window.isDestroyed() || prompting) return;
    prompting = true;
    try {
      const {response} = await dialog.showMessageBox(window, {
        type: 'error', title: translate('Legion was interrupted'),
        message: translate('The game stopped unexpectedly.'),
        detail: translate('Reload to reconnect if your match is still running.'),
        buttons: [translate('Reload game'), translate('Close Legion')], defaultId: 0, cancelId: 1,
      });
      if (window.isDestroyed()) return;
      if (response === 0) {
        if (reason === 'unresponsive') {
          restarting = true;
          window.webContents.once('did-finish-load', () => {restarting = false;});
          window.webContents.forcefullyCrashRenderer();
        }
        window.webContents.reload();
      }
      else window.close();
    } catch (error) {
      console.error('Could not recover the renderer:', error);
      if (!window.isDestroyed()) window.close();
    } finally {
      prompting = false;
    }
  };
  window.webContents.on('render-process-gone', (_event, {reason}) => {
    if (restarting) {restarting = false; return;}
    return recover(reason);
  });
  window.on('unresponsive', () => recover('unresponsive'));
  window.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) void recover('load-failed');
  });
}

module.exports = {installRendererRecovery};
