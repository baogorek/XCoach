// Initialize Global Background variables
let anchorTabId;
let interventionTabId;
let anchorTabOpenTime;
let warnTimer;
let closeTimer;
let openTwitterTabs = new Set();

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

function updateTotalOpenTime(sessionDurationInSeconds) {
    chrome.storage.local.get('XVisitSeconds', function(data) {
        let dailyVisitTime = data.XVisitSeconds || 0;
        dailyVisitTime += sessionDurationInSeconds; 
        chrome.storage.local.set({ 'XVisitSeconds': dailyVisitTime}, function() {
            console.log('Total open time today updated:', dailyVisitTime);
        });
    });
}

// Tracking functions ---------------------------------------------------
function trackTwitterTab(tabId) {
    if (anchorTabId) {  // TODO: could replace with length opentwittertabs > 0
        console.log(`Tracking Twitter tab: ${tabId}`);
        openTwitterTabs.add(tabId);
    }
}

// Note: untrack is used in 2 listeners: onUpdated and onRemoved.
function untrackTwitterTab(tabId) {
    if (tabId === anchorTabId) {  // TODO: is this really necessary?
        console.log(`Anchor tab: ${tabId} closed. Closing all twitter tabs.`);
        closeAllTwitterTabs();
    } else {
       // this is the user closing a secondary twitter tab
       console.log(`Untracking non-anchor Twitter tab: ${tabId} as it has been closed`);
       openTwitterTabs.delete(tabId);
    }
}

function closeAllTwitterTabs() {
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.remove(tabId);
    });

    let anchorTabLifetime = (Date.now() - anchorTabOpenTime) / 1000;
    console.log(`Anchor tab was alive for ${anchorTabLifetime}`);
    updateTotalOpenTime(anchorTabLifetime);
    
    //  Reinstantiate the intervention mechanism
    chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
        console.log('Redirect disable flag updated to false');
    });

    // Reload the intervention tab to work as a debrief tab, if it's still open
    if (interventionTabId) {
        chrome.tabs.reload(interventionTabId);
    }

    // Reinitialize global background variables 
    anchorTabId = null;
    anchorTabOpenTime = null;
    warnTimer = null;
    closeTimer = null;
    openTwitterTabs = new Set();
}

// Messages for content-modify.js (acting on Twitter) ---------------------------
function warnAllTwitterTabs() {
    console.log("Warn all twitter tabs");
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, { action: "warnClose", tabId: tabId });
    });
}

function removeWarningAllTwitterTabs() {
    console.log("Remove warnings from twitter tabs");
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, { action: "removeWarning", tabId: tabId });
    });
}


function wipeTimers() {
    if (warnTimer) clearTimeout(warnTimer);
    if (closeTimer) clearTimeout(closeTimer);
    warnTimer = null;
    closeTimer = null;
}

function scheduleTabClosure(timeLimitInSeconds) {
    console.log(`scheduling anchor tab closure for ${timeLimitInSeconds} seconds from now`);
    wipeTimers();
    warnTimer = setTimeout(warnAllTwitterTabs, timeLimitInSeconds * 1000 - (15 * 1000));
    closeTimer = setTimeout(closeAllTwitterTabs, timeLimitInSeconds * 1000);
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

// Set up listeners -------------------------------------------------

// Chrome alarms listeners
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "compileDailyData") {
    console.log("Alarm: compileDailyData triggered");
    compileAndStoreDailyData();
  }
});

// Chrome runtime listeners
chrome.runtime.onInstalled.addListener(scheduleDailyDataCompilation);
chrome.runtime.onStartup.addListener(scheduleDailyDataCompilation);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "allowXAccess") {
        console.log('Requested time limit: ', request.timeLimit);

        incrementVisitCount();
        setLastVisitDateToLocal();
      
        chrome.storage.local.set({temporaryRedirectDisable: true}, () => {
            console.log('Redirection disable flag updated to true');
        });

        interventionTabId = sender.tab.id;

        console.log(`I believe this is the intervention tab id: ${interventionTabId}`);

        // creating the anchor tab
        chrome.tabs.create({ url: 'https://twitter.com' }, (newTab) => {
            console.log(`Tab id is ${newTab.id}`);
            anchorTabId = newTab.id;  // ToDo: do you really need an anchor tab?
            openTwitterTabs.add(anchorTabId);
            anchorTabOpenTime = Date.now();
            console.log(`Anchor Twitter tab Id set to: ${anchorTabId}, opened at ${anchorTabOpenTime}`);
            scheduleTabClosure(request.timeLimit * 60);
        });

    } else if (request.action === "snooze" && anchorTabId) {
        console.log(`Will snooze using the anchor tab id is ${anchorTabId}`);
        scheduleTabClosure(60);  // additional 60 seconds feels right
    }
});

// Chrome tabs listeners: has to work for ANY chrome tab at any time -----

// Tab ON UPDATED
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (anchorTabId && changeInfo.url) {
        console.log(`Tab ${tabId} changed. onUpdated listener alerted`);
        console.log(changeInfo.url);
        if (changeInfo.url.includes("twitter.com")) {
            console.log("Found a URL with Twitter in it. About to track");
            trackTwitterTab(tabId);
            console.log("done running trackTwitterTab. openTwitterTabs is");
            console.log(openTwitterTabs);
        } else if (openTwitterTabs.has(tabId)) {  // tab that was on twitter navigated away.
            console.log(`Twitter tab left twitter. I untracking tab id ${tabId}`);
            untrackTwitterTab(tabId);
        }
    }
});

// Tab ON REMOVED
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (anchorTabId) {
        if (openTwitterTabs.has(tabId) && tabId !== anchorTabId) {
            untrackTwitterTab(tabId);
        }
    }
    if (tabId === interventionTabId) {  // User closes intervention tab
        interventionTabId = null; 
    }
});

// Run code that runs regardless ------------------------------------------------

chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
    console.log('Redirect disable flag set to false');
});
