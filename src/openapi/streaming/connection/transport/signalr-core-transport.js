import log from '../../../../log';
import * as constants from './../constants';

const NAME = 'signalrCore';
const LOG_AREA = 'SignalrCoreTransport';
const NOOP = () => {};

/**
 * Handles any signal-r log, and pipes it through our logging.
 * @param message
 */
function handleLog(level, message) {
    if (level < signalRCore.LogLevel.Warning) {
        return;
    }

    switch (level) {
        case signalRCore.LogLevel.Warning:
            log.warn(LOG_AREA, message);
            break;

        case signalRCore.LogLevel.Error:
        case signalRCore.LogLevel.Critical:
            log.error(LOG_AREA, message);
            break;
    }
}

/**
 * SignalR Transport which supports both webSocket and longPolling with internal fallback mechanism.
 */
function SignalrCoreTransport(url, restTransport, transportFailCallback) {
    this.name = NAME;
    this.url = url;
    this.connection = null;

    // callbacks
    this.transportFailCallback = transportFailCallback;
    this.stateChangedCallback = NOOP;
    this.receivedCallback = NOOP;
    this.errorCallback = NOOP;
}

SignalrCoreTransport.NAME = NAME;

SignalrCoreTransport.prototype.isSupported = () => true;

SignalrCoreTransport.prototype.start = function(options, callback) {
    if (!this.connection) {
        log.error(
            LOG_AREA,
            "connection doesn't exist, call updateQuery before start",
        );
        return;
    }

    this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);

    this.connection.onclose = (error) => {
        if (error) {
            this.errorCallback(error);
        }

        this.stop();
    };

    this.connection.on('ReceiveMessage', (message) =>
        this.receivedCallback(message),
    );

    this.connection
        .start()
        .then(() => {
            callback();
            this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
        })
        .catch((error) => {
            this.connection.onclose = null;
            this.connection.off('ReceiveMessage');

            this.transportFailCallback(error);
        });
};

SignalrCoreTransport.prototype.stop = function() {
    if (!this.connection) {
        log.warn(LOG_AREA, "connection doesn't exist");
        return;
    }

    this.connection.onclose = null;
    this.connection.off('ReceiveMessage');
    this.connection.stop();

    this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
    this.connection = null;
};

SignalrCoreTransport.prototype.updateQuery = function(authToken, contextId) {
    try {
        this.connection = signalRCore
            .HubConnectionBuilder()
            .withUrl(this.url, {
                headers: {
                    'x-openapi-contextid': contextId,
                },
                accessTokenFactory: () => authToken,
            })
            .configureLogging({
                log: handleLog,
            })
            .build();
    } catch (error) {
        this.transportFailCallback(error);
    }
};

SignalrCoreTransport.prototype.setStateChangedCallback = function(callback) {
    this.stateChangedCallback = callback;
};

SignalrCoreTransport.prototype.setReceivedCallback = function(callback) {
    this.receivedCallback = callback;
};

SignalrCoreTransport.prototype.setErrorCallback = function(callback) {
    this.errorCallback = callback;
};

SignalrCoreTransport.prototype.setConnectionSlowCallback = NOOP;

SignalrCoreTransport.prototype.setUnauthorizedCallback = NOOP;

export default SignalrCoreTransport;
