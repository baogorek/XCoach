// Utility functions for the developer --------------------------------

// console.log = function() {};

function clearAllChromeSyncData() {
    chrome.storage.sync.clear(function() {
        var error = chrome.runtime.lastError;
        if (error) {
            console.error('Error clearing the sync storage:', error);
        } else {
            console.log('All sync storage data cleared.');
        }
    });
}

function showData() {
    chrome.storage.sync.get(null, function(data) {
        console.log(data);
    });
}

function showAlarms() {

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

function replaceDailyDataWithTestData1() {
    const testData = [
        {"date": "2024-02-01", "XVisitCount": 3, "XVisitSeconds": 6028}
    ];

    chrome.storage.sync.set({'dailyData': testData}, function() {
        console.log('dailyData has been replaced with test data.');
    });
}

function replaceDailyDataWithTestData5() {
    const testData = [
        {"date": "2024-02-01", "XVisitCount": 3, "XVisitSeconds": 6028},
        {"date": "2024-02-02", "XVisitCount": 3, "XVisitSeconds": 6157},
        {"date": "2024-02-03", "XVisitCount": 7, "XVisitSeconds": 5817},
        {"date": "2024-02-04", "XVisitCount": 9, "XVisitSeconds": 6005},
        {"date": "2024-02-05", "XVisitCount": 6, "XVisitSeconds": 6119}
    ];

    chrome.storage.sync.set({'dailyData': testData}, function() {
        console.log('dailyData has been replaced with test data.');
    });
}

function replaceDailyDataWithTestData15() {
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

    chrome.storage.sync.set({'dailyData': testData}, function() {
        console.log('dailyData has been replaced with test data.');
    });
}

// Data functions -----------------------------------------------------------

function updateTotalOpenTime(sessionDurationInSeconds) {
    chrome.storage.sync.get(['XVisitSeconds', 'XOpenTimestamp'], function(data) {
        if (data.XOpenTimestamp) {
            let dailyVisitTime = data.XVisitSeconds || 0;
            let sessionDurationInSeconds = (Date.now() - data.XOpenTimestamp) / 1000;

            dailyVisitTime += sessionDurationInSeconds; 

            chrome.storage.sync.set({ 'XVisitSeconds': dailyVisitTime}, function() {
                console.log('Total open time today updated to:', dailyVisitTime, 'seconds');
                chrome.storage.sync.set({ 'XOpenTimestamp': null }, function() {
                    console.log('X/ Open Timestamp reset.');
                });
            });
        }
    });
}

// Tracking functions ---------------------------------------------------
function trackXTab(tabId) {
    getOpenXTabs().then((openXTabs) => {
        if (openXTabs.size > 0) {
            console.log(`Tracking X tab: ${tabId}`);
            openXTabs.add(tabId);
            setOpenXTabs(openXTabs);
        }
    });
}

function untrackXTabFromTabEvent(tabId) {
    // Called in both change and remove tab listeners to untrack a tab
    getOpenXTabs().then((openXTabs) => {
        openXTabs.delete(tabId);
        setOpenXTabs(openXTabs);
        if (openXTabs.size === 0) {
            console.log(`Last X tab ${tabId} closed. Going to exit logic.`);
            closeAllXTabs(openXTabs);
        } else {
           console.log(`Untracking a X tab: ${tabId}`);
           console.log(openXTabs);
        }
    });
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

function closeAllXTabs(tabsToClose) {
    // Can get triggered by timer or by untrack being called with 1 X tab open
    console.log("Close the X tabs:", tabsToClose);
    tabsToClose.forEach(tabId => {
        chrome.tabs.remove(tabId);
    });
    setOpenXTabs(new Set());
  
    wipeTimers();

    updateTotalOpenTime();
    
    //  Reinstantiate the intervention mechanism
    chrome.storage.sync.set({temporaryRedirectDisable: false}, () => {
        console.log('Redirect disable flag updated to false');
    });

    chrome.storage.sync.get('interventionTabId', (result) => {
        reloadTabIfOpen(result.interventionTabId);
    }); 
}

// Messages for content-modify.js (acting on X) ---------------------------
function warnAllXTabs(tabsToWarn) {
    console.log("Warn the X tabs:", tabsToWarn);
    tabsToWarn.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, {action: "warnClose", tabId: tabId},
            function(response) { console.log("warn response"); }
        );
    });
}

function removeWarningAllXTabs(tabsToClear) {
    console.log("Remove the warning for the X tabs:", tabsToClear);
    tabsToClear.forEach(tabId => {
        chrome.tabs.sendMessage(tabId, {action: "removeWarning", tabId: tabId},
            function(response) { console.log("close response"); }
        );
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

function scheduleAllTabsClosure(timeLimitInMinutes) {
    // Should never be called with timeLimitInMinutes < 2, but UI prevents this
    console.log(`scheduling session end ${timeLimitInMinutes} minutes from now`);
    chrome.alarms.create("warnTimer", {"delayInMinutes": timeLimitInMinutes - 1});
    chrome.alarms.create("closeTimer", {"delayInMinutes": timeLimitInMinutes});
}

function incrementVisitCount() {
    chrome.storage.sync.get('XVisitCount', function(data) {
        let currentCount = data.XVisitCount || 0;
        currentCount++;
        chrome.storage.sync.set({ 'XVisitCount': currentCount }, function() {
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

    chrome.storage.sync.set({ 'lastVisitDate': today }, function() {
        console.log(`lastVisitDate updated to ${today}, reflecting local time zone.`);
    });
}

// Get and Set "sync" variables from Chrome sync storage

function setOpenXTabs(openXTabs) {
    const openTabsArray = Array.from(openXTabs);
    chrome.storage.sync.set({ openXTabs: openTabsArray }, function() {
    });
}

function getOpenXTabs() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get({openXTabs: []}, (result) => {
            const openXTabsSet = new Set(result.openXTabs || []);
            resolve(openXTabsSet); // Pass the set to resolve to ensure it's available to then()
        });
    });
}

function setInterventionTabId(tabId) {
    chrome.storage.sync.set({ interventionTabId: tabId }, function() {
        console.log(`Intervention Tab ID saved: ${tabId}`);
    });
}

function setXOpenTimestamp(timestamp) {
    chrome.storage.sync.set({ XOpenTimestamp: timestamp }, function() {
        console.log(`X Open Timestamp saved: ${timestamp}`);
    });
}


// Set up listeners -------------------------------------------------

// Chrome alarms listeners
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log("in the chrome.alarms.onAlarm listener with alarm", alarm);
    if (alarm.name === "warnTimer") {
        console.log("Alarm: warnTimer triggered");
        getOpenXTabs().then((openXTabs) => {
            warnAllXTabs(openXTabs);
        }).catch((error) => {
            console.error("Error handling warnTimer alarm:", error);
        });
    }
    if (alarm.name === "closeTimer") {
        console.log("Alarm: closeTimer triggered");
        getOpenXTabs().then((openXTabs) => {
            closeAllXTabs(openXTabs);
        }).catch((error) => {
            console.error("Error handling closeTimer alarm:", error);
        }); 
    }   
});


// Chrome runtime listeners

chrome.runtime.onInstalled.addListener((details) => {
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
    chrome.storage.sync.set({ temporaryRedirectDisable: false }, () => {
        console.log('Redirect disable flag set to false');
    });
    chrome.storage.sync.set({ 'XOpenTimestamp': null }, function() {
        console.log('X Open Timestamp reset.');
    });
    chrome.storage.sync.set({ 'interventionTabId': null }, function() {
        console.log('X Open Timestamp reset.');
    });
    setOpenXTabs(new Set());
    wipeTimers();
}); 

const handleOnMessageBackground = (request, sender, sendResponse) => { 
    if (request.action === "allowXAccess") {
        scheduleAllTabsClosure(request.timeLimit);  // Prioritize alarm setting
        incrementVisitCount();
        setLastVisitDateToLocal();
        chrome.storage.sync.set({temporaryRedirectDisable: true}, () => {
            console.log('Redirection disable flag updated to true');
        });
        setInterventionTabId(sender.tab.id);
        setXOpenTimestamp(Date.now());
        chrome.tabs.create({ url: 'https://www.x.com' }, (newTab) => {
            console.log("In chrome.tabs.create after creating the first X tab of the session");
            getOpenXTabs().then((openXTabs) => {
                openXTabs.add(newTab.id);
                setOpenXTabs(openXTabs);
                sendResponse(); // Respond back to ensure message lifecycle is properly handled
            });
        });
    } else if (request.action === "snooze") {
        scheduleAllTabsClosure(request.minutes);  // Prioritize alarm setting
        getOpenXTabs().then((openXTabs) => {
            if (openXTabs.size > 0) {
                console.log(`Snooze for ${request.minutes} minutes requested`);
                removeWarningAllXTabs(openXTabs);
                sendResponse();
            }
        });
    }
    return true;  //  tells Chrome that you intend to respond asynchronously
};

// Chrome tabs listeners: has to work for ANY chrome tab at any time -----

const handleTabsOnUpdated = (tabId, changeInfo, tab) => {
    console.log("Handling Tabs OnUpdated event in background.js");
    if (changeInfo.url) {  // Don't pull data from storage unless you have to
        getOpenXTabs().then((openXTabs) => {
            if (openXTabs.size > 0) {
                console.log(`Tab ${tabId} changed: ${changeInfo.url}. onUpdated listener alerted`);
                if (changeInfo.url.startsWith("https://x.com")) {
                    console.log("Change listener found a URL with x.com in it (maybe a tab that was already on X). Tracking if new.");
                    trackXTab(tabId);  // TODO: check that this is idempotent, because changes are coming in on the initial X window
                // NOTE: if your if condition doesn't catch the x tab 
                } else if (openXTabs.has(tabId)) {  // tab that was on x.com navigated away.
                    console.log(`Tab that was on X left to ${changeInfo.url}. Untracking tab id ${tabId}`);
                    untrackXTabFromTabEvent(tabId, "navigated away");
                }
            }
        });
    };
};

const handleTabsOnRemoved = (tabId, removeInfo) => {
    console.log("Handling Tabs OnRemoved event in background.js");
    getOpenXTabs().then((openXTabs) => {
        if (openXTabs.size > 0) {
            if (openXTabs.has(tabId)) {
                untrackXTabFromTabEvent(tabId, "tab removed");
            }
        }
    });
};

// Run code that runs regardless ------------------------------------------------
chrome.runtime.onMessage.addListener(handleOnMessageBackground);
chrome.tabs.onUpdated.addListener(handleTabsOnUpdated);
chrome.tabs.onRemoved.addListener(handleTabsOnRemoved);
