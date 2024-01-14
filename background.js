let tabClosingTimes = {};
let tabOriginalTimeLimits = {};
let tabTimers = {};


function handleError(errorContext) {
    if (chrome.runtime.lastError) {
        console.error(`Error: ${errorContext}: ${chrome.runtime.lastError.message}`);
    }
}

function reEnableRules() {
    chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["ruleset1"],
    }, () => {
        handleError("re-enabling rules");
        console.log("Rules re-enabled successfully");
    });
}

function scheduleTabClosure(tabId, timeLimitInSeconds, isSnooze = false) {
    let currentTime = Date.now();
    let newClosingTime = currentTime + timeLimitInSeconds * 1000;
    tabClosingTimes[tabId] = newClosingTime;

    // NOTE: currious to try to get rid of the snooze variable and just see if the key exists
    if (!isSnooze && !tabOriginalTimeLimits[tabId]) {
        tabOriginalTimeLimits[tabId] = timeLimitInSeconds;
    } else {
        tabOriginalTimeLimits[tabId] += timeLimitInSeconds;
    }

    if (tabTimers[tabId]) {
      clearTimeout(tabTimers[tabId].warnTimer);
      clearTimeout(tabTimers[tabId].closeTimer);
    }
   
    tabTimers[tabId] = {
        warnTimer: setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: "warnClose", tabId: tabId});
        }, timeLimitInSeconds * 1000 - 15 * 1000),
        closeTimer: setTimeout(() => {
            chrome.tabs.remove(tabId);
        }, timeLimitInSeconds * 1000)
    };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "allowXAccess") {
        console.log(request.timeLimit);

        chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ["ruleset1"],
        }, () => {
            handleError("disabling rules");

            chrome.tabs.create({ url: 'https://twitter.com' }, (newTab) => {
                console.log(`Tab id is ${newTab.id}`);
                scheduleTabClosure(newTab.id, request.timeLimit * 60);
            });
        });
    } else if (request.action === "snooze" && sender.tab) {
        console.log(`In snooze with tab id of ${sender.tab.id}`);
        let additionalTime = 60;
        scheduleTabClosure(sender.tab.id, additionalTime, true);
    }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (tabClosingTimes[tabId] && tabOriginalTimeLimits[tabId]) {
        let actualClosingTime = Date.now();
        let scheduledClosingTime = tabClosingTimes[tabId];
        let originalTimeLimitSeconds = tabOriginalTimeLimits[tabId];

        let openingTime = scheduledClosingTime - originalTimeLimitSeconds * 1000;

        let openDurationInSeconds = (actualClosingTime - openingTime) / 1000;

        console.log(`Tab was open for ${openDurationInSeconds} seconds`);
        reEnableRules();

        // Clean up
        delete tabClosingTimes[tabId];
        delete tabOriginalTimeLimits[tabId];

        if (tabTimers[tabId]) {
            clearTimeout(tabTimers[tabId].warnTimer);
            clearTimeout(tabTimers[tabId].closeTimer);
            delete tabTimers[tabId];
        }
    }
});

