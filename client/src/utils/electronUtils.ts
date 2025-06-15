/**
 * Utility functions for Electron environment detection and interaction
 */

/**
 * Detects if the application is running in an Electron environment
 * Uses multiple detection methods for reliability:
 * 1. Check if window.process.type === 'renderer' (standard Electron detection)
 * 2. Check navigator.userAgent for 'electron/' string (fallback method)
 * 
 * @returns {boolean} True if running in Electron, false otherwise
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         ((window as any).process?.type === 'renderer' || 
          navigator.userAgent.toLowerCase().indexOf(' electron/') > -1);
};

/**
 * Gets the Electron API if available (exposed via preload script)
 * @returns {any} The electronAPI object or null if not available
 */
export const getElectronAPI = (): any => {
  return typeof window !== 'undefined' && isElectron() ? (window as any).electronAPI : null;
}; 