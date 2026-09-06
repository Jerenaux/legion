/**
 * Utility functions for Electron environment detection and interaction
 */
import type { PlatformCredential } from '../services/platformSession';

interface ElectronAPI {
  isFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
  getPlatformAuth: () => Promise<PlatformCredential | null>;
  showGamepadTextInput: (options: unknown) => Promise<unknown>;
  getControllerType: () => Promise<string>;
}

type ElectronWindow = Window & {
  process?: { type?: string };
  electronAPI?: ElectronAPI;
};

/**
 * Detects if the application is running in an Electron environment
 * Uses multiple detection methods for reliability:
 * 1. Check if window.process.type === 'renderer' (standard Electron detection)
 * 2. Check navigator.userAgent for 'electron/' string (fallback method)
 *
 * @returns {boolean} True if running in Electron, false otherwise
 */
export const isElectron = (): boolean => {
  const hasWindow = typeof window !== 'undefined';
  const hasProcess = hasWindow && (window as ElectronWindow).process?.type === 'renderer';
  const hasElectronUA = hasWindow && navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

  // console.log('electronUtils: isElectron check:', {
  //   hasWindow,
  //   hasProcess,
  //   hasElectronUA,
  //   userAgent: hasWindow ? navigator.userAgent : 'no window',
  //   windowProcess: hasWindow ? (window as any).process : 'no window'
  // });

  const result = hasWindow && (hasProcess || hasElectronUA);
  // console.log('electronUtils: isElectron result =', result);

  return result;
};

/**
 * Gets the Electron API if available (exposed via preload script)
 * @returns The preload API, or null outside Electron.
 */
export const getElectronAPI = (): ElectronAPI | null => {
  const hasWindow = typeof window !== 'undefined';
  const electronAPI = hasWindow && isElectron() ? (window as ElectronWindow).electronAPI ?? null : null;

  // console.log('electronUtils: getElectronAPI check:', {
  //   hasWindow,
  //   isElectron: isElectron(),
  //   electronAPI,
  //   windowHasElectronAPI: hasWindow && !!(window as any).electronAPI,
  //   electronAPIKeys: electronAPI ? Object.keys(electronAPI) : 'null',
  //   windowElectronKeys: hasWindow ? Object.keys(window).filter(key => key.toLowerCase().includes('electron')) : 'no window'
  // });

  return electronAPI;
};
