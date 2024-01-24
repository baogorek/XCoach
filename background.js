let tabClosingTimes = {};
let tabOriginalTimeLimits = {};
let tabTimers = {};
let totalOpenTimeTodayInSeconds = 0;
let lastRecordedDate = new Date().toDateString();

// New logic for trying to close multiple tabs
let anchorTabId = null;
let openTwitterTabs = new Set();

function trackTwitterTab(tabId) {
    console.log(`Tracking Twitter tab: ${tabId}`);
    if (anchorTabId === null) {
        anchorTabId = tabId; // Set the first tab as the anchor
    }
    openTwitterTabs.add(tabId);
}

// Function to untrack a Twitter tab
function untrackTwitterTab(tabId) {
    console.log(`Untracking Twitter tab: ${tabId}`);
    openTwitterTabs.delete(tabId);
    if (tabId === anchorTabId) {
        // The anchor tab is closed, close all other Twitter tabs
        closeAllTwitterTabs();
        anchorTabId = null; // Reset the anchor tab
    }
}

// Function to close all tracked Twitter tabs
function closeAllTwitterTabs() {
    openTwitterTabs.forEach(tabId => {
        if (tabId !== anchorTabId) { // Avoid closing the anchor tab again
            chrome.tabs.remove(tabId);
        }
    });
    openTwitterTabs.clear();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        if (changeInfo.url.includes("twitter.com")) {
            trackTwitterTab(tabId);
        } else if (openTwitterTabs.has(tabId)) {
            untrackTwitterTab(tabId);
        }
    }
});


chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (openTwitterTabs.has(tabId)) {
        untrackTwitterTab(tabId);
    }
});

// Back to the older code

function updateTotalOpenTime(openDurationInSeconds) {
    const today = new Date().toDateString();
    if (lastRecordedDate !== today) {
        totalOpenTimeTodayInSeconds = 0;
        lastRecordedDate = today;
    }
    totalOpenTimeTodayInSeconds += openDurationInSeconds;
    chrome.storage.local.set({ 'XVisitMinutes': totalOpenTimeTodayInSeconds });
}


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
        
        if (sender.tab) {
            chrome.tabs.remove(sender.tab.id, handleError.bind(null, "closing intervention tab"));
        }
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

        updateTotalOpenTime(openDurationInSeconds);
        reEnableRules();

        chrome.tabs.create({ url: 'debrief.html' });

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

