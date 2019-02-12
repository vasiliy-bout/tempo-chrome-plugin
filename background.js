(function () {
    function SetMultimap() {
        this.data = {};
    }
    SetMultimap.prototype = {
        "put": function (key, value) {
            let data = this.data;
            if (!data.hasOwnProperty(key)) {
                data[key] = {};
            }
            data[key][value] = value;
            return value;
        },
        "delete": function (key, value) {
            let data = this.data;
            if (!data.hasOwnProperty(key)) {
                return false;
            }
            let map = data[key];
            if (!map.hasOwnProperty(value)) {
                return false;
            }
            delete map[value];
            if (Object.keys(map).length === 0) {
                delete data[key];
            }
            return true;
        },
        "size": function (key) {
            let data = this.data;
            if (key == null) {
                let total_size = 0;
                for (key in data) {
                    if (data.hasOwnProperty(key)) {
                        total_size += Object.keys(data[key]).length;
                    }
                }
                return total_size;
            }

            if (!data.hasOwnProperty(key)) {
                return 0;
            }
            return Object.keys(data[key]).length;
        }
    };


    let requests = new SetMultimap();

    let start_callback = function (details) {
        let tabId = details.tabId;
        let requestId = details.requestId;

        requests.put(tabId, requestId);

        send_requests_change(tabId, details.frameId);

        //console.log('start', details);
        //console.log('request_start', tabId, requestId);
        //console.log('state_size', requests.size());
    };
    let finish_callback = function (details) {
        let tabId = details.tabId;
        let requestId = details.requestId;

        requests.delete(tabId, requestId);

        send_requests_change(tabId, details.frameId);

        //console.log('finish', details);
        //console.log('request_finish', tabId, requestId);
        //console.log('state_size', requests.size());
    };

    let new_tab_callback = function (message, sender, sendResponse) {
        let filter = {
            "urls": ["http://app.tempo.io/*", "https://app.tempo.io/*"],
            "tabId": sender.tab.id
        };

        chrome.webRequest.onBeforeRequest.addListener(start_callback, filter);
        chrome.webRequest.onCompleted.addListener(finish_callback, filter);

        sendResponse(null);
    };


    let content_callback = function (message, sender, sendResponse) {
        if (message.type === "new_tab") {
            new_tab_callback(message, sender, sendResponse);
        } else {
            console.error("Unexpected message:", message);
        }
    };
    chrome.runtime.onMessage.addListener(content_callback);


    function send_requests_change(tabId, frameId) {
        let options = {};
        if (frameId != null) {
            options["frameId"] = frameId;
        }

        let message = {
            "type": "request_number_change",
            "request_number": requests.size(tabId)
        };

        chrome.tabs.sendMessage(tabId, message, options);
    }
})();
