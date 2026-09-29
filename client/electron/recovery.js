const {dialog} = require('electron');

function installRendererRecovery(window) {
  let prompting = false;
  window.webContents.on('render-process-gone', async (_event, {reason}) => {
    if (reason === 'clean-exit' || window.isDestroyed() || prompting) return;
    prompting = true;
    try {
      const {response} = await dialog.showMessageBox(window, {
        type: 'error', title: 'Legion was interrupted',
        message: 'The game stopped unexpectedly.',
        detail: 'Reload to reconnect if your match is still running. If this happens again, close other apps to free up memory.',
        buttons: ['Reload game', 'Close Legion'], defaultId: 0, cancelId: 1,
      });
      if (window.isDestroyed()) return;
      if (response === 0) window.webContents.reload();
      else window.close();
    } catch (error) {
      console.error('Could not recover the renderer:', error);
      if (!window.isDestroyed()) window.close();
    } finally {
      prompting = false;
    }
  });
}

module.exports = {installRendererRecovery};
