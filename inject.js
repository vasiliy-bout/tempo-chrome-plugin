(function () {
    const LOG_PREFIX = "[FIX TEMPO PLUGIN]:";
    const DEBUG_ENABLED = false;

    function log() {
        console.log(LOG_PREFIX, ...arguments);
    }

    function error() {
        console.error(LOG_PREFIX, ...arguments);
    }

    function debug() {
        if (DEBUG_ENABLED) {
            console.log(LOG_PREFIX, "[DEBUG]", ...arguments);
        }
    }

    // noinspection ES6ConvertVarToLetConst
    var currentForm = null;
    // noinspection ES6ConvertVarToLetConst
    var lastRequestsNumber = 0;

    function updateFormInputs(form, request_number) {
        let inputs = form.getElementsByTagName("input");
        let timeSpentSeconds = inputs.namedItem("timeSpentSeconds");
        if (request_number > 0) {
            timeSpentSeconds.setAttribute("disabled", "disabled");
        } else {
            timeSpentSeconds.removeAttribute("disabled");
        }
    }

    registerFormObserver({
        "onFormAdded": function (form) {
            // noinspection ReuseOfLocalVariableJS
            currentForm = form;

            updateFormInputs(currentForm, lastRequestsNumber);
        },
        "onFormRemoved": function (form) {
            // noinspection ReuseOfLocalVariableJS
            currentForm = null;
        }
    });


    setupRequestsTracker(function (request_number) {
        // noinspection ReuseOfLocalVariableJS
        lastRequestsNumber = request_number;

        if (currentForm != null) {
            updateFormInputs(currentForm, request_number);
        }
    });

    function registerFormObserver(callbacks) {
        function findWorklogForm(nodesList) {
            for (let node of nodesList) {
                if (node instanceof HTMLElement) {
                    let forms = node.getElementsByTagName("form");
                    let worklog = forms.namedItem("worklogForm");
                    if (worklog) {
                        return worklog;
                    }
                }
            }
            return null;
        }

        let globalCallback = function (mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes && callbacks.onFormAdded) {
                        let worklog = findWorklogForm(mutation.addedNodes);
                        if (worklog) {
                            callbacks.onFormAdded(worklog);
                        }
                    }
                    if (mutation.removedNodes && callbacks.onFormRemoved) {
                        let worklog = findWorklogForm(mutation.removedNodes);
                        if (worklog) {
                            callbacks.onFormRemoved(worklog);
                        }
                    }
                }
            }
        };

        let config = {
            childList: true,
            subtree: true
        };
        let observer = new MutationObserver(globalCallback);
        observer.observe(document.body, config);
    }

    function setupRequestsTracker(callback) {
        let request_number_change_callback = function (message) {
            callback(message["request_number"]);
        };

        let content_callback = function (message, sender, sendResponse) {
            if (message.type === "request_number_change") {
                request_number_change_callback(message, sender, sendResponse);
            } else {
                console.error("Unexpected message:", message);
            }
        };
        chrome.runtime.onMessage.addListener(content_callback);

        chrome.runtime.sendMessage({"type": "new_tab"});
    }
})();
