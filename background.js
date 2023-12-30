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

