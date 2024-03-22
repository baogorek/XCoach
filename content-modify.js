// console.log = function() {};

// The Intervention mechanism -------
chrome.storage.local.get('temporaryRedirectDisable', function(data) {
    console.log(data);
    if (!data.temporaryRedirectDisable) {
        const interventionUrl = chrome.runtime.getURL("intervention.html");
        console.log("InterventionURL is", interventionUrl);
        window.location.href = interventionUrl;
    }
});
// End Intervention mechanism ------

// Runtime message handler ----- 
handleOnMessageContent = (request, sender, sendResponse) => {
    if (request.action === "warnClose") { // As in, warn that it's about to close
        let warningBanner = document.createElement('div');
        warningBanner.id = 'RedWarningBannerId';

        // Banner styling
        warningBanner.style.position = 'fixed';
        warningBanner.style.top = '0';
        warningBanner.style.left = '50%';
        warningBanner.style.transform = 'translateX(-60%)';
        warningBanner.style.backgroundColor = '#FF4500';
        warningBanner.style.color = 'white';
        warningBanner.style.textAlign = 'center';
        warningBanner.style.paddingLeft = '20px';
        warningBanner.style.paddingRight = '20px';
        warningBanner.style.paddingTop = '10px';
        warningBanner.style.paddingBottom = '10px';
        warningBanner.style.borderRadius = '10px';
        warningBanner.style.zIndex = '1000';
        warningBanner.innerText = 'Your XCoach: This tab will close in under a minute!';

        // Dismiss button
        let dismissBtn = document.createElement('button');
        dismissBtn.innerText = 'Dismiss';
        dismissBtn.style.marginLeft = '15px';
        dismissBtn.onclick = function() {
            warningBanner.remove();
        };
        warningBanner.appendChild(dismissBtn);

        // Snooze button
        let snoozeBtn = document.createElement('button');
        snoozeBtn.innerText = 'Snooze (2 min)';
        snoozeBtn.style.marginLeft = '15px';
        snoozeBtn.onclick = function() {
            chrome.runtime.sendMessage({ action: "snooze", tabId: request.tabId });
        };
        warningBanner.appendChild(snoozeBtn);

        document.body.appendChild(warningBanner);
        sendResponse();

    } else if (request.action === "removeWarning") {
        let warningBanner = document.getElementById('RedWarningBannerId');
        warningBanner.remove();
        console.log('Tried to remove warning banner');
        sendResponse();
    } 
    return true; // if I was to use sendResponse, I'd do so asyncronously. Keep channel open.
};

chrome.runtime.onMessage.addListener(handleOnMessageContent);
