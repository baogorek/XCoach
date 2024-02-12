const targetUrl = "chrome-extension://ipifmofnonjimpofbdankhjjajkbnnch/intervention.html";

chrome.storage.local.get('temporaryRedirectDisable', function(data) {
  if (!data.temporaryRedirectDisable) {
    window.location.href = targetUrl; 
  } else {
    console.log("Redirection to intervention is currently disabled.");
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "warnClose") {
        let warningBanner = document.createElement('div');
        warningBanner.id = 'warningBannerId';

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
        warningBanner.innerText = 'Your XCoach: This tab will close in under 15 seconds!';

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
        snoozeBtn.innerText = 'Snooze (1 min)';
        snoozeBtn.style.marginLeft = '15px';
        snoozeBtn.onclick = function() {
            chrome.runtime.sendMessage({ action: "snooze", tabId: request.tabId });
        };
        warningBanner.appendChild(snoozeBtn);

        document.body.appendChild(warningBanner);

    } else if (request.action === "snooze") {
        let warningBanner = document.getElementById('warningBannerId');
        console.log('In content-modify.js, trying to remove the banner for a snooze');
        console.log('Warning Banner is', warningBanner);
        if (warningBanner) {
            warningBanner.remove();
        }
    } 
});


