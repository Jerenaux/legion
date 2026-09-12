import LogRocket from 'logrocket';
import {logRocketOptions} from './telemetryConfig';
import {getElectronAPI} from './utils/electronUtils';
if (process.env.NODE_ENV !== 'development' && !getElectronAPI()?.smokeTest) {
    LogRocket.init('bpfssp/legion', logRocketOptions);
}

export default LogRocket;
