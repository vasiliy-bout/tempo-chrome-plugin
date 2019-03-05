(function () {
    function debug() {
        if (console.debug) {
            console.debug(...arguments);
        }
    }

    /*
     * Declare SetMultimap data structure
     */
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
        "deleteKey": function (key) {
            let data = this.data;
            if (!data.hasOwnProperty(key)) {
                return null;
            }
            let old = data[key];
            delete data[key];
            return old;
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


    /*
     * Global browser state across all tabs and windows.
     */
    let requests = new SetMultimap();
    let state = {
        tabEventsRegistered: {}, // map[tabId -> boolean]
        lastTabLoadingState: {}  // map[tabId -> string]
    };


    /*
     * Declare event handlers which control global state for a browser tab.
     */
    let start_callback = function (details) {
        let tabId = details.tabId;
        let requestId = details.requestId;

        requests.put(tabId, requestId);
        send_requests_change(tabId, details.frameId);

        debug('webRequest.onBeforeRequest:', tabId, requestId, " -> ", requests.size(tabId));
    };
    let finish_callback = function (details) {
        let tabId = details.tabId;
        let requestId = details.requestId;

        if (!requests.delete(tabId, requestId)) {
            console.warn("Request was already removed:", tabId, requestId);
        }
        send_requests_change(tabId, details.frameId);

        debug('webRequest.onCompleted:', tabId, requestId, " -> ", requests.size(tabId));
    };

    let tab_updated_callback = function(tabId, changeInfo, tab) {
        debug("tabs.onUpdated(", tabId, changeInfo, tab, ") -> ", requests.size(tabId));

        // Skip the event if no status is available.
        if (changeInfo.status == null) {
            return;
        }
        // When tab is refreshed, remove all the previous requests.
        if (changeInfo.status === "loading") {
            // Loading event is sometimes generated when active requests are already
            // in progress. This check helps to avoid removing active requests from the
            // current state.
            if (!state.lastTabLoadingState.hasOwnProperty(tabId) ||
                    state.lastTabLoadingState[tabId] !== "loading") {
                let old = requests.deleteKey(tabId);
                if (old != null) {
                    console.log("Previous state was removed:", old);
                }
                send_requests_change(tabId, null);
            }
        }
        state.lastTabLoadingState[tabId] = changeInfo.status;
    };
    let tab_replaced_callback = function(addedTabId, removedTabId) {
        console.warn("Unhandled replace event");
        debug("tabs.onReplaced(", addedTabId, removedTabId, ") -> ",
            requests.size(addedTabId), " / ", requests.size(removedTabId));
    };
    let tab_removed_callback = function(tabId, removeInfo) {
        debug("tabs.onRemoved(", tabId, removeInfo, ") -> ", requests.size(tabId));

        let old = requests.deleteKey(tabId);
        if (old != null) {
            debug("Tab state was removed:", tabId, old);
        }

        // Delete tab from state variables
        delete state.tabEventsRegistered[tabId];
        delete state.lastTabLoadingState[tabId];
    };
    chrome.tabs.onUpdated.addListener(tab_updated_callback);
    chrome.tabs.onReplaced.addListener(tab_replaced_callback);
    chrome.tabs.onRemoved.addListener(tab_removed_callback);


    /*
     * Register browser tab event handlers for every new tab that matches specific filters.
     */
    let new_tab_callback = function (message, sender, sendResponse) {
        let tabId = sender.tab.id;
        debug("Tempo is being loaded in tab:", tabId);

        // noinspection NegatedIfStatementJS
        if (!state.tabEventsRegistered.hasOwnProperty(tabId)) {
            let filter = {
                "urls": ["http://app.tempo.io/*", "https://app.tempo.io/*"],
                "tabId": sender.tab.id
            };

            chrome.webRequest.onBeforeRequest.addListener(start_callback, filter);
            chrome.webRequest.onCompleted.addListener(finish_callback, filter);

            state.tabEventsRegistered[tabId] = true;
            debug("Event handlers were registered:", tabId);
        } else {
            debug("Event handlers have previously been registered:", tabId);
        }

        sendResponse(null);
    };

    /*
     * Send back the counter value for the requester tab.
     */
    let read_counter_callback = function (message, sender, sendResponse) {
        let tabId = sender.tab.id;
        let size = requests.size(tabId);
        sendResponse(size);
    };


    /*
     * Register a handler that responds to a browser tab requests.
     */
    let content_callback = function (message, sender, sendResponse) {
        switch (message.type) {
            case "new_tab":
                new_tab_callback(message, sender, sendResponse);
                break;
            case "read_counter":
                read_counter_callback(message, sender, sendResponse);
                break;
            default:
                console.error("Unexpected message:", message);
                break;
        }
    };
    chrome.runtime.onMessage.addListener(content_callback);


    /*
     * Declare auxiliary functions below.
     */
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
