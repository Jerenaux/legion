import {getElectronAPI} from './utils/electronUtils';

const desktop = getElectronAPI();

export const telemetryConfig = {
  hotjar: false,
  sentryReplay: process.env.NODE_ENV === 'production'
    && process.env.BUILD_TARGET === 'electron'
    && process.env.SENTRY_REPLAY_ENABLED === 'true'
    && desktop?.isPackaged === true
    && !desktop.smokeTest
    && window.location.protocol === 'app:'
    && window.location.host === 'legion',
} as const;
