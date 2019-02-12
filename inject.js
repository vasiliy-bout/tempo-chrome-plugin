// this is the code which will be injected into a given page...

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


    registerFormObserver();

    function formObserverCallback(mutationsList, observer) {
        for (let mutation of mutationsList) {
            if (mutation.type === 'attributes') {
                if (mutation.attributeName === "value") {
                    if (mutation.target.changesState) {
                        mutation.target.changesState.handleValueChange();
                    } else {
                        error("NO STATE FOUND", mutation);
                    }
                }
            }
        }
    }
    let formObserver = new MutationObserver(formObserverCallback);

    function worklogFormRemovedHandler(form) {
        formObserver.disconnect();
        log("Worklog form observer disconnected");
    }

    function worklogFormAddedHandler(form) {
        log('Worklog form found', form);

        function State(input) {
            const self = this;
            self.target = input;
            self.target.changesState = self;

            self.oldValue = self.target.value;
            self.hadInputEvent = false;

            self.dumpToLog = function () {
                debug("    ", "self.oldValue", self.oldValue);
                debug("    ", "self.hadInputEvent", self.hadInputEvent);
                debug("    ", "self.target.value", self.target.value);
            };

            self.handleValueChange = function () {
                debug("Value change detected for target", self.target);
                self.dumpToLog();

                if (!self.hadInputEvent && self.oldValue !== self.target.value) {
                    log("Revert value", self.target.value, " -> ", self.oldValue);
                    self.target.value = self.oldValue;
                    self.target.setAttribute("value", self.oldValue);
                    debug("Value reverted for target", self.target.value, self.target);
                }
                self.hadInputEvent = false;
                self.oldValue = self.target.value;

                debug("State updated to");
                self.dumpToLog();
            };

            self.startTracking = function () {
                self.target.addEventListener("input", function (e) {
                    self.hadInputEvent = true;
                    debug("Input detected for target", e.data, self.target);
                });

                let config = {
                    attributes: true,
                    childList: false,
                    subtree: false
                };
                formObserver.observe(self.target, config);

                log("Observer registered for target", self.target);
            };
        }

        let timeSpentSeconds = form.getElementsByTagName("input").namedItem("timeSpentSeconds");
        new State(timeSpentSeconds).startTracking();
    }

    function registerFormObserver() {
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

        let callback = function (mutationsList, observer) {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes) {
                        let worklog = findWorklogForm(mutation.addedNodes);
                        if (worklog) {
                            worklogFormAddedHandler(worklog);
                        }
                    }
                    if (mutation.removedNodes) {
                        let worklog = findWorklogForm(mutation.removedNodes);
                        if (worklog) {
                            worklogFormRemovedHandler(worklog);
                        }
                    }
                }
            }
        };

        let config = {
            childList: true,
            subtree: true
        };
        let observer = new MutationObserver(callback);
        observer.observe(document.body, config);
    }
})();
