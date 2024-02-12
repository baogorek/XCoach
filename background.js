let tabClosingTimes = {};
let tabOriginalTimeLimits = {};
let tabTimers = {};
let anchorTabId = null;
let openTwitterTabs = new Set();
let lastRecordedDate = new Date().toDateString();


function resetCountsIfNewDay() {
    const today = new Date().toDateString();
    chrome.storage.local.get('lastVisitDate', function(data) {
        if (data.lastVisitDate !== today) {
            console.log("data.lastVisitDate !== today")
            chrome.storage.local.set(
            {
                'XVisitCount': 0,
                'XVisitSeconds': 0,
                'lastVisitDate': today
            });
            updateCountDisplay();
        }
    });
}

function trackTwitterTab(tabId) {
    console.log(`Tracking Twitter tab: ${tabId}`);

    if (anchorTabId === null) {
        anchorTabId = tabId; // Set the first tab as the anchor
    }
    openTwitterTabs.add(tabId);
}

function untrackTwitterTab(tabId) {
    console.log(`Untracking Twitter tab: ${tabId}`);
    openTwitterTabs.delete(tabId);
    if (tabId === anchorTabId) {
        // The anchor tab is closed, close all other Twitter tabs
        closeAllTwitterTabs();
        anchorTabId = null; // Reset the anchor tab
    }
}

function closeAllTwitterTabs() {
    openTwitterTabs.forEach(tabId => {
        if (tabId !== anchorTabId) { // Avoid closing the anchor tab again
            chrome.tabs.remove(tabId);
        }
    });
    openTwitterTabs.clear();
}

function updateTotalOpenTime(sessionDurationInSeconds) {
    chrome.storage.local.get('XVisitSeconds', function(data) {
        let dailyVisitTime = data.XVisitSeconds || 0;
        dailyVisitTime += sessionDurationInSeconds; 
        chrome.storage.local.set({ 'XVisitSeconds': dailyVisitTime}, function() {
            console.log('Total open time today updated:', dailyVisitTime);
        });
    });
}

function handleError(errorContext) {
    if (chrome.runtime.lastError) {
        console.error(`Error: ${errorContext}: ${chrome.runtime.lastError.message}`);
    }
}


function warnAllTwitterTabs(action) {
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, { action: action, tabId: tabId });
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
            warnAllTwitterTabs("warnClose");
        }, timeLimitInSeconds * 1000 - 15 * 1000),
        closeTimer: setTimeout(() => {
            chrome.tabs.remove(tabId);
        }, timeLimitInSeconds * 1000)
    };
}

function incrementVisitCount() {
    chrome.storage.local.get('XVisitCount', function(data) {
        let currentCount = data.XVisitCount || 0;
        currentCount++;
        chrome.storage.local.set({ 'XVisitCount': currentCount }, function() {
            console.log('Visit count incremented to', currentCount);
        });
    });
}

// Run code and set up listeners -----------------------------------------

resetCountsIfNewDay();

chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
    console.log('Redirect disable flag set to false');
});


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

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "allowXAccess") {
        console.log('Requested time limit: ', request.timeLimit);
        incrementVisitCount();
      
        chrome.storage.local.set({temporaryRedirectDisable: true}, () => {
            console.log('Redirection disable flag updated to true');
        });

        if (sender.tab) {
            chrome.tabs.remove(sender.tab.id, handleError.bind(null, "closing intervention tab"));
        }

        chrome.tabs.create({ url: 'https://twitter.com' }, (newTab) => {
            console.log(`Tab id is ${newTab.id}`);
            scheduleTabClosure(newTab.id, request.timeLimit * 60);
        });
    } else if (request.action === "snooze" && sender.tab) {
        console.log(`In snooze with tab id of ${sender.tab.id}`);
        console.log(`Will snooze using the anchor tab id is ${anchorTabId}`);
        let additionalTime = 60;
        scheduleTabClosure(anchorTabId, additionalTime, true);
        warnAllTwitterTabs("snooze");
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

        chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
            console.log('Redirect disable flag updated to false');
        });

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

