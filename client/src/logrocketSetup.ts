import LogRocket from 'logrocket';
import {logRocketOptions} from './telemetryConfig';
if (process.env.NODE_ENV !== 'development') {
    LogRocket.init('bpfssp/legion', logRocketOptions);
}

export default LogRocket;
