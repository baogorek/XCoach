console.log = function() {};

// The Intervention mechanism -------
chrome.storage.sync.get('temporaryRedirectDisable', function(data) {
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
        warningBanner.innerText = 'XCoach: X tabs will close in under a minute!';

        // Dismiss button
        let dismissBtn = document.createElement('button');
        dismissBtn.innerText = 'Dismiss';
        dismissBtn.style.marginLeft = '15px';
        dismissBtn.style.backgroundColor = '#555555';
        dismissBtn.onclick = function() {
            warningBanner.remove();
        };
        warningBanner.appendChild(dismissBtn);

        // Snooze button
        let snoozeBtn = document.createElement('button');
        snoozeBtn.innerText = 'Snooze';
        snoozeBtn.style.backgroundColor = '#555555';
        snoozeBtn.style.marginLeft = '15px';
        snoozeBtn.onclick = function() {
            let snoozeMinutes = parseInt(snoozeInput.value, 10);
            if (!isNaN(snoozeMinutes) && snoozeMinutes >= 2 && snoozeMinutes <= 120) {
                chrome.runtime.sendMessage({ action: "snooze", minutes: snoozeMinutes });
            } else {
                alert('Please enter a valid number of minutes between 2 and 120.');
            }
        };
        warningBanner.appendChild(snoozeBtn);

        // Input box for custom snooze time
        let snoozeInput = document.createElement('input');
        snoozeInput.type = 'number';
        snoozeInput.value = '2';
        snoozeInput.min = '2';
        snoozeInput.max = '120';
        snoozeInput.step = '1';
        snoozeInput.style.marginLeft = '15px';
        snoozeInput.style.padding = '5px';
        snoozeInput.style.borderRadius = '5px';
        snoozeInput.style.border = '1px solid #ccc';
        snoozeInput.style.width = '40px';
        warningBanner.appendChild(snoozeInput);

        // Finish word minutes
        let minutesText = document.createElement('span');
        minutesText.innerText = 'minutes';
        minutesText.style.marginLeft = '5px';
        minutesText.style.color = 'white'; // Ensure text color matches the banner
        warningBanner.appendChild(minutesText);

        // Finished creating the warning banner
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
