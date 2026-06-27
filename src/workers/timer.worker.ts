/* eslint-disable no-restricted-globals */

let timerID: number | null = null;
let interval = 25.0;

self.onmessage = function (e: MessageEvent) {
    if (e.data === 'start') {
        if (timerID) {
            self.clearInterval(timerID);
            timerID = null;
        }
        if (interval > 0) {
            timerID = self.setInterval(function () {
                self.postMessage('tick');
            }, interval);
        }
    } else if (e.data.interval) {
        interval = e.data.interval;
        if (timerID) {
            self.clearInterval(timerID);
            timerID = self.setInterval(function () {
                self.postMessage('tick');
            }, interval);
        }
    } else if (e.data === 'stop') {
        if (timerID) {
            self.clearInterval(timerID);
            timerID = null;
        }
    }
};

export { };
