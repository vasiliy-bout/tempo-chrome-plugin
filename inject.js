(function () {
    const LOG_PREFIX = "[FIX TEMPO PLUGIN]:";

    function log() {
        console.log(LOG_PREFIX, ...arguments);
    }

    function error() {
        console.error(LOG_PREFIX, ...arguments);
    }

    function debug() {
        if (console.debug) {
            console.debug(LOG_PREFIX, "[DEBUG]", ...arguments);
        }
    }

    let currentState = {
        form: null,
        lastRequestsNumber: null
    };

    function moveFocusWhenDescriptionExists(form) {
        let comment = form.getElementsByTagName("textarea").namedItem("comment");
        if (comment && comment.value) {
            let timeSpentSeconds = form.getElementsByTagName("input").namedItem("timeSpentSeconds");
            if (timeSpentSeconds) {
                timeSpentSeconds.focus();
            }
        }
    }

    function updateFormInputs(form, request_number) {
        let handler;
        if (request_number > 0) {
            handler = function(input) {
                input.setAttribute("disabled", "disabled");
            };
        } else {
            handler = function(input) {
                input.removeAttribute("disabled");
            };
        }

        for (let input of form.getElementsByTagName("input")) {
            handler(input);
        }

        if (request_number === 0) {
            moveFocusWhenDescriptionExists(form);
        }
    }

    registerFormObserver({
        "onFormAdded": function (form) {
            currentState.form = form;

            updateFormInputs(form, currentState.lastRequestsNumber);
        },
        "onFormRemoved": function (form) {
            currentState.form = null;
        }
    });


    setupRequestsTracker(function (request_number) {
        currentState.lastRequestsNumber = request_number;

        if (currentState.form != null) {
            updateFormInputs(currentState.form, request_number);
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
                error("Unexpected message:", message);
            }
        };
        chrome.runtime.onMessage.addListener(content_callback);

        chrome.runtime.sendMessage({"type": "new_tab"});
    }
})();
