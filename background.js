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

function generateTestDataForDays(numDays) {
    const endDate = new Date();
    const testData = [];

    for (let day = 0; day < numDays; day++) {
        const date = new Date();
        date.setDate(endDate.getDate() - day);
        const dateString = formatDate(date);

        // Assume between 3 to 10 sessions per day
        const sessionCount = Math.floor(Math.random() * 8 + 3);
        let totalSeconds = 0;

        for (let i = 0; i < sessionCount; i++) {
            // Sessions last between 5 minutes to 120 minutes
            const sessionDuration = Math.floor(Math.random() * 115 + 5) * 60;
            totalSeconds += sessionDuration;
        }

        testData.push({ date: dateString, XVisitCount: sessionCount, XVisitSeconds: totalSeconds });
    }

    chrome.storage.sync.set({ dailyData: testData }, function() {
        console.log(`Test data for ${numDays} days has been set.`);
    });
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}


// Data functions -----------------------------------------------------------

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
   
    //  Reinstantiate the intervention mechanism
    chrome.storage.sync.set({temporaryRedirectDisable: false}, () => {
        console.log('Redirect disable flag updated to false');
    });

    chrome.storage.sync.get('interventionTabId', (result) => {
        reloadTabIfOpen(result.interventionTabId);
    }); 

    // Update the session duration only if the tab was closed before expected
    chrome.storage.sync.get({ sessions: {}, currentSessionTimestamp: Date.now() }, function(data) {
        const sessions = data.sessions;
        const currentSessionTimestamp = data.currentSessionTimestamp;
        const now = Date.now();
    
        // Calculate the existing end time for comparison
        const existingEndTime = sessions[currentSessionTimestamp] || now;
        const existingDifference = existingEndTime - currentSessionTimestamp;
        const currentDifference = now - currentSessionTimestamp;
    
        // Update the session with the smaller difference
        if (currentDifference < existingDifference) {
            sessions[currentSessionTimestamp] = now;
            console.log(`Updated session ${currentSessionTimestamp} with new end time: ${now}`);
        } else {
            console.log(`Session ${currentSessionTimestamp} already has a smaller difference: ${existingDifference}`);
        }
    
        // Save updated sessions
        chrome.storage.sync.set({ sessions: sessions }, function() {
            console.log(`Saved sessions with key: ${currentSessionTimestamp}`);
        });
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
    chrome.storage.sync.set({ 'interventionTabId': null }, function() {
        console.log('X Open Timestamp reset.');
    });
    setOpenXTabs(new Set());
    wipeTimers();
}); 

const handleOnMessageBackground = (request, sender, sendResponse) => { 
    if (request.action === "allowXAccess") {
        scheduleAllTabsClosure(request.timeLimit);
        incrementVisitCount();
        chrome.storage.sync.get({ sessions: {} }, function(data) {
          const sessions = data.sessions;
          const currentSessionTimestamp = Date.now();
          sessions[currentSessionTimestamp] = Date.now() + (request.timeLimit * 60 * 1000);
          chrome.storage.sync.set({ sessions: sessions, currentSessionTimestamp: currentSessionTimestamp }, function() {
              console.log(`Added key to sessions data structure: ${currentSessionTimestamp}`);
          });
        }); 
        chrome.storage.sync.set({temporaryRedirectDisable: true}, () => {
            console.log('Redirection disable flag updated to true');
        });
        setInterventionTabId(sender.tab.id);
        chrome.tabs.create({ url: 'https://www.x.com' }, (newTab) => {
            console.log("In chrome.tabs.create after creating the first X tab of the session");
            getOpenXTabs().then((openXTabs) => {
                openXTabs.add(newTab.id);
                setOpenXTabs(openXTabs);
                sendResponse(); // Respond back to ensure message lifecycle is properly handled
            });
        });
    } else if (request.action === "snooze") {
        scheduleAllTabsClosure(request.minutes);
        chrome.storage.sync.get({ sessions: {}, currentSessionTimestamp: Date.now()}, function(data) {
          const sessions = data.sessions;
          const currentSessionTimestamp = data.currentSessionTimestamp;
          sessions[currentSessionTimestamp] = Date.now() + (request.minutes * 60 * 1000);
          chrome.storage.sync.set({ sessions: sessions }, function() {
              console.log(`Added ${request.minutes} to sessions key: ${currentSessionTimestamp}`);
          });
        }); 
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
                    trackXTab(tabId);
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
