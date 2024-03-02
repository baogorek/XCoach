console.log = function() {};

handleOnMessageContent = (request, sender, sendResponse) => {
    if (request.action === "warnClose") { // As in, warn that it's about to close
        let warningBanner = document.createElement('div');
        warningBanner.id = 'RedWarningBannerId';

        // Banner styling
        warningBanner.style.position = 'fixed';
        warningBanner.style.top = '0';
        warningBanner.style.left = '0';
        warningBanner.style.width = '100%';
        warningBanner.style.backgroundColor = 'red';
        warningBanner.style.color = 'white';
        warningBanner.style.textAlign = 'center';
        warningBanner.style.padding = '10px';
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

    } else if (request.action === "removeWarning") {
        let warningBanner = document.getElementById('RedWarningBannerId');
        warningBanner.remove();
        console.log('Tried to remove warning banner');
    } 
};


// Code that runs regardless ------------------------------------

chrome.runtime.onMessage.addListener(handleOnMessageContent);

// Twitter / X intervention mechanism ------- 
chrome.storage.local.get('temporaryRedirectDisable', function(data) {
  if (!data.temporaryRedirectDisable) {
    window.location.href = "chrome-extension://ipifmofnonjimpofbdankhjjajkbnnch/intervention.html";
  }
});


