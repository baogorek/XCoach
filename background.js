chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "allowXAccess") {
        chrome.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds: ["ruleset1"],
        }, () => {
            if (chrome.runtime.lastError) {
                console.error(`Error disabling rules: ${chrome.runtime.lastError}`);
            } else {
                console.log("Rules disabled successfully");
                chrome.tabs.create({ url: 'https://twitter.com' }, (newTab) => {
                    chrome.tabs.onUpdated.addListener(function tabUpdateListener(tabId, changeInfo, tab) {
                        if (tabId === newTab.id && changeInfo.status === 'complete') {
                            chrome.declarativeNetRequest.updateEnabledRulesets({
                                enableRulesetIds: ["ruleset1"],
                            }, () => {
                                if (chrome.runtime.lastError) {
                                    console.error(`Error re-enabling rules: ${chrome.runtime.lastError}`);
                                } else {
                                    console.log("Rules re-enabled successfully");
                                    // Start a timer to close the tab after 15 minutes
                                    setTimeout(() => {
                                        chrome.tabs.remove(newTab.id, () => {
                                            if (chrome.runtime.lastError) {
                                                console.error(`Error closing tab: ${chrome.runtime.lastError}`);
                                            }
                                        });
                                    }, 0.5 * 60 * 1000); // First number is minutes
                                }
                                chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                            });
                        }
                    });
                });
            }
        });
    }
});

