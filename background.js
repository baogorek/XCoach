// Utility functions for the developer --------------------------------

// console.log = function() {};

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

function showAlarms() {
    chrome.alarms.get("compileDailyData", function(alarm) {
        if (alarm) {
            let alarmDate = new Date(alarm.scheduledTime);
            console.log(`compileDailyData to go off at ${alarmDate}`);
        };
    });

    chrome.alarms.get("closeTimer", function(alarm) {
        if (alarm) {
            let alarmDate = new Date(alarm.scheduledTime);
            console.log(`Close Alarm Scheduled to go off at ${alarmDate}`);
        };
    });

    chrome.alarms.get("warnTimer", function(alarm) {
        if (alarm) {
            let alarmDate = new Date(alarm.scheduledTime);
            console.log(`Warn Alarm Scheduled to go off at ${alarmDate}`);
        };
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
    chrome.storage.local.get(['XVisitSeconds', 'twitterOpenTimestamp'], function(data) {
        if (data.twitterOpenTimestamp) {
            let dailyVisitTime = data.XVisitSeconds || 0;
            let sessionDurationInSeconds = (Date.now() - data.twitterOpenTimestamp) / 1000;

            dailyVisitTime += sessionDurationInSeconds; 

            chrome.storage.local.set({ 'XVisitSeconds': dailyVisitTime}, function() {
                console.log('Total open time today updated to:', dailyVisitTime, 'seconds');
                chrome.storage.local.set({ 'twitterOpenTimestamp': null }, function() {
                    console.log('Twitter Open Timestamp reset.');
                });
            });
        }
    });
}

// Tracking functions ---------------------------------------------------
function atLeastOneTwitterTab() {
    // Needs to be called in a getOpenTwitterTabs promise
    return openTwitterTabs.size > 0;
}

function trackTwitterTab(tabId) {
    // Needs to be called in a getOpenTwitterTabs promise
    if (atLeastOneTwitterTab()) {
        console.log(`Tracking Twitter tab: ${tabId}`);
        openTwitterTabs.add(tabId);
        setOpenTwitterTabs(openTwitterTabs);
    }
}

function untrackTwitterTabFromTabEvent(tabId) {
    // Needs to be called in a getOpenTwitterTabs promise
    // This function is called in both tab listeners
    openTwitterTabs.delete(tabId);
    setOpenTwitterTabs(openTwitterTabs);
    if (openTwitterTabs.size === 0) {
        console.log(`Last Twitter tab ${tabId} closed. Going to exit logic.`);
        closeAllTwitterTabs();
    } else {
       console.log(`Untracking a Twitter tab: ${tabId}`);
       console.log(openTwitterTabs);
    }
}

function reloadTabIfOpen(tabId) {
    if (tabId) {
        chrome.tabs.get(tabId, (tab) => {
            if (!chrome.runtime.lastError && tab) {
                chrome.tabs.reload(tabId, () => {
                    console.log("Tab reloaded successfully.");
                });
            } else {
                console.log("Tried to close nonexistant tab.");
            }
        })
    }
}

function closeAllTwitterTabs() {
    // Can get triggered by timer or by untrack being called with 1 twitter tab open
    console.log("Close all twitter tabs");
    let twitterTabsToClose = openTwitterTabs;
    setOpenTwitterTabs(new Set());

    twitterTabsToClose.forEach(tabId => {
        chrome.tabs.remove(tabId);
    });
  
    wipeTimers();

    updateTotalOpenTime();
    
    //  Reinstantiate the intervention mechanism
    chrome.storage.local.set({temporaryRedirectDisable: false}, () => {
        console.log('Redirect disable flag updated to false');
    });

    chrome.storage.local.get('interventionTabId', (result) => {
        reloadTabIfOpen(result.interventionTabId);
    }); 
}

// Messages for content-modify.js (acting on Twitter) ---------------------------
function warnAllTwitterTabs() {
    // needs to be called in a getOpenTwitterTabs promise
    console.log("Warn all twitter tabs");
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, { action: "warnClose", tabId: tabId });
    });
}

function removeWarningAllTwitterTabs() {
    // needs to be called in a getOpenTwitterTabs promise
    console.log("Remove warnings from twitter tabs");
    openTwitterTabs.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, { action: "removeWarning", tabId: tabId });
    });
}

function wipeTimers() {
    chrome.alarms.clear("warnTimer", () => {
        console.log("Warning alarm cleared.");
    });
    chrome.alarms.clear("closeTimer", () => {
        console.log("Closure alarm cleared.");
    });
}

function scheduleTabClosure(timeLimitInMinutes) {
    // Should never be called with timeLimitInMinutes < 2, but UI prevents this
    console.log(`scheduling session end ${timeLimitInMinutes} minutes from now`);
    chrome.alarms.create("warnTimer", {"delayInMinutes": timeLimitInMinutes - 1});
    chrome.alarms.create("closeTimer", {"delayInMinutes": timeLimitInMinutes});
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

// Get and Set "local" variables from Chrome local storage

function setOpenTwitterTabs(openTwitterTabs) {
    const openTabsArray = Array.from(openTwitterTabs);
    chrome.storage.local.set({ openTwitterTabs: openTabsArray }, function() {
        console.log('Open Twitter tabs saved');
    });
}
function getOpenTwitterTabs() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get({openTwitterTabs: []}, (result) => {
            openTwitterTabs = new Set(result.openTwitterTabs);
            console.log("Getting openTwitterTabs from Chrome local storage:", openTwitterTabs);
            resolve();
        });
    });
}

function setInterventionTabId(tabId) {
    chrome.storage.local.set({ interventionTabId: tabId }, function() {
        console.log(`Intervention Tab ID saved: ${tabId}`);
    });
}

function setTwitterOpenTimestamp(timestamp) {
    chrome.storage.local.set({ twitterOpenTimestamp: timestamp }, function() {
        console.log(`Twitter Open Timestamp saved: ${timestamp}`);
    });
}


// Set up listeners -------------------------------------------------

// Chrome alarms listeners
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "compileDailyData") {
        console.log("Alarm: compileDailyData triggered");
        compileAndStoreDailyData();
    }

    if (alarm.name === "warnTimer") {
        console.log("Alarm: warnTimer triggered");
        warnAllTwitterTabs();
    }

    if (alarm.name === "closeTimer") {
        console.log("Alarm: closeTimer triggered");
        closeAllTwitterTabs();
    }

});

// Chrome runtime listeners

chrome.runtime.onInstalled.addListener((details) => {
    // Just a stub for now
    console.log(`XCoach onInstalledListener activated. Details:`);
    console.log(details);
    if (details.reason === "install") {
        console.log("Performing initial setup...");
    } else if (details.reason === "update") {
        console.log("Updating to new version...");
    }
});

chrome.runtime.onStartup.addListener(() => {

    console.log("XCoach: Starting Chrome");
    chrome.storage.local.set({ temporaryRedirectDisable: false }, () => {
        console.log('Redirect disable flag set to false');
    });
    chrome.storage.local.set({ 'twitterOpenTimestamp': null }, function() {
        console.log('Twitter Open Timestamp reset.');
    });
    chrome.storage.local.set({ 'interventionTabId': null }, function() {
        console.log('Twitter Open Timestamp reset.');
    });
    scheduleDailyDataCompilation();
    setOpenTwitterTabs(new Set());
    wipeTimers();
}); 

const handleOnMessageBackground = (request, sender, sendResponse) => { 
    console.log("Handling OnMessage event in background.js");

    if (request.action === "allowXAccess") {
        console.log('Requested time limit: ', request.timeLimit);

        incrementVisitCount();
        setLastVisitDateToLocal();
      
        chrome.storage.local.set({temporaryRedirectDisable: true}, () => {
            console.log('Redirection disable flag updated to true');
        });

        setInterventionTabId(sender.tab.id);
        setTwitterOpenTimestamp(Date.now());

        // creating the first official Twitter tab 
        chrome.tabs.create({ url: 'https://twitter.com' }, (newTab) => {
            console.log("In chrome.tabs.create after creating the first twitter tab of the session");

            getOpenTwitterTabs().then(() => {
                openTwitterTabs.add(newTab.id);
                setOpenTwitterTabs(openTwitterTabs);
                scheduleTabClosure(request.timeLimit);
            });
        });

    } else if (request.action === "snooze") {
        getOpenTwitterTabs().then(() => {
            if (atLeastOneTwitterTab()) {
                console.log("Snooze 2 minutes requested");
                removeWarningAllTwitterTabs();
                scheduleTabClosure(2);
            }
        });
    }
};

// Chrome tabs listeners: has to work for ANY chrome tab at any time -----

const handleTabsOnUpdated = (tabId, changeInfo, tab) => {
    console.log("Handling Tabs OnUpdated event in background.js");
    if (changeInfo.url) {  // Don't pull data from local storage unless you have to
        getOpenTwitterTabs().then(() => {
            if (atLeastOneTwitterTab()) {
                console.log(`Tab ${tabId} changed. onUpdated listener alerted`);
                console.log(changeInfo.url);
                if (changeInfo.url.includes("twitter.com")) {
                    console.log("Change listener found a URL with Twitter in it. Tracking.");
                    trackTwitterTab(tabId);
                    console.log(openTwitterTabs);
                } else if (openTwitterTabs.has(tabId)) {  // tab that was on twitter navigated away.
                    console.log(`Twitter tab left twitter. I untracking tab id ${tabId}`);
                    untrackTwitterTabFromTabEvent(tabId, "navigated away");
                }
            }
        });
    };
};

const handleTabsOnRemoved = (tabId, removeInfo) => {
    console.log("Handling Tabs OnRemoved event in background.js");
    getOpenTwitterTabs().then(() => {
        if (atLeastOneTwitterTab()) {
            if (openTwitterTabs.has(tabId)) {
                untrackTwitterTabFromTabEvent(tabId, "tab removed");
            }
        }
    });
};

// Run code that runs regardless ------------------------------------------------
chrome.runtime.onMessage.addListener(handleOnMessageBackground);
chrome.tabs.onUpdated.addListener(handleTabsOnUpdated);
chrome.tabs.onRemoved.addListener(handleTabsOnRemoved);
