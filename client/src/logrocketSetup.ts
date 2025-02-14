import LogRocket from 'logrocket';
if (process.env.NODE_ENV !== 'development') {
    LogRocket.init('bpfssp/legion');
}

export default LogRocket;