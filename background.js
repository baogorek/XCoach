let tabClosingTimes = {};
let tabOriginalTimeLimits = {};
let tabTimers = {};
let anchorTabId = null;
let openTwitterTabs = new Set();
let lastRecordedDate = new Date().toDateString();


// Utility functions for the developer --------------------------------

function clearAllChromeLocalData() {
    chrome.storage.local.clear(function() {
        var error = chrome.runtime.lastError;
        if (error) {
            console.error('Error clearing the local storage:', error);
        } else {
            console.log('All local storage data cleared.');
        }
    });
}

function showData() {
    chrome.storage.local.get(null, function(data) {
        console.log(data);
    });
}

function showAlarm() {
    chrome.alarms.get("compileDailyData", function(alarm) {
        console.log(alarm);
        let alarmDate = new Date(alarm.scheduledTime);
        console.log(`Scheduled to go off at ${alarmDate}`);
    });
}

function triggerAlarm() {
    chrome.alarms.create("compileDailyData", { when: Date.now() + 5000 });
}

function replaceDailyDataWithTestData() {
    const testData = [
        {"date": "2024-02-01", "XVisitCount": 3, "XVisitSeconds": 6028},
        {"date": "2024-02-02", "XVisitCount": 3, "XVisitSeconds": 6157},
        {"date": "2024-02-03", "XVisitCount": 7, "XVisitSeconds": 5817},
        {"date": "2024-02-04", "XVisitCount": 9, "XVisitSeconds": 6005},
        {"date": "2024-02-05", "XVisitCount": 6, "XVisitSeconds": 6119},
        {"date": "2024-02-06", "XVisitCount": 5, "XVisitSeconds": 5853},
        {"date": "2024-02-07", "XVisitCount": 4, "XVisitSeconds": 5969},
        {"date": "2024-02-08", "XVisitCount": 3, "XVisitSeconds": 6049},
        {"date": "2024-02-09", "XVisitCount": 8, "XVisitSeconds": 6032},
        {"date": "2024-02-10", "XVisitCount": 3, "XVisitSeconds": 5925},
        {"date": "2024-02-11", "XVisitCount": 5, "XVisitSeconds": 6092},
        {"date": "2024-02-12", "XVisitCount": 8, "XVisitSeconds": 5911},
        {"date": "2024-02-13", "XVisitCount": 8, "XVisitSeconds": 6076},
        {"date": "2024-02-14", "XVisitCount": 4, "XVisitSeconds": 6109},
        {"date": "2024-02-15", "XVisitCount": 5, "XVisitSeconds": 6094}
    ];

    chrome.storage.local.set({'dailyData': testData}, function() {
        console.log('dailyData has been replaced with test data.');
    });
}

// Data functions -----------------------------------------------------------

function scheduleDailyDataCompilation() {
  // Calculate the time until the next midnight
  let now = new Date();
  let nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  chrome.alarms.create("compileDailyData", { when: nextMidnight.getTime(), periodInMinutes: 1440 });
}

function compileAndStoreDailyData() {
    chrome.storage.local.get(
        ['XVisitCount', 'XVisitSeconds', 'dailyData', 'lastVisitDate'], function(data) {
        let lastVisitDate = data.lastVisitDate;
        let dailyData = data.dailyData || [];

        if (lastVisitDate) {
            dailyData.push({
                date: lastVisitDate,
                XVisitCount: data.XVisitCount || 0,
                XVisitSeconds: data.XVisitSeconds || 0,
            });
            chrome.storage.local.set({
                XVisitCount: 0,
                XVisitSeconds: 0,
                dailyData: dailyData,
            }, function() {
                console.log(`Data compiled for ${lastVisitDate} and variables reset.`);
                console.log(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
                "is the time after the alarm has run. And here is the data:")
                console.log(data);
            });
        } else {
            console.error(`Problem compiled data for ${lastVisitDate}.`);
        }
    });
}

// Tracking functions ---------------------------------------------------
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

function setLastVisitDateToLocal() {
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // getMonth() is zero-indexed, so add 1
    let day = now.getDate();

    // Ensure month and day are in 2-digit format
    month = ('0' + month).slice(-2);
    day = ('0' + day).slice(-2);

    let today = `${year}-${month}-${day}`;

    chrome.storage.local.set({ 'lastVisitDate': today }, function() {
        console.log(`lastVisitDate updated to ${today}, reflecting local time zone.`);
    });
}


// Run startup code ------------------------------------------------

// resetCountsIfNewDay();

chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
    console.log('Redirect disable flag set to false');
});


// Set up listeners -------------------------------------------------
chrome.runtime.onInstalled.addListener(scheduleDailyDataCompilation);
chrome.runtime.onStartup.addListener(scheduleDailyDataCompilation);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "compileDailyData") {
    console.log("Alarm: compileDailyData triggered");
    compileAndStoreDailyData();
  }
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
        setLastVisitDateToLocal();
      
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

