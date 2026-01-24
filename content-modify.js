console.log = function() {};

// The Intervention mechanism -------
chrome.storage.sync.get('temporaryRedirectDisable', function(data) {
    console.log(data);
    if (!data.temporaryRedirectDisable) {
        const interventionUrl = chrome.runtime.getURL("intervention.html");
        console.log("InterventionURL is", interventionUrl);
        window.location.href = interventionUrl;
    } else {
        initPostButtonModifier();
    }
});
// End Intervention mechanism ------

// Post button modifier - shows "Post as @handle" ------
function getCurrentHandle() {
    const switcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (switcher) {
        for (const span of switcher.querySelectorAll('span')) {
            const text = span.textContent.trim();
            if (text.startsWith('@')) return text;
        }
    }
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
        const href = profileLink.getAttribute('href');
        if (href) return '@' + href.replace('/', '');
    }
    return null;
}

function modifyPostButtons(handle) {
    const selectors = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]';
    document.querySelectorAll(selectors).forEach(button => {
        if (button.dataset.xcoachHandleApplied) return;
        const innerSpan = button.querySelector('span > span');
        if (innerSpan && innerSpan.textContent.trim() === 'Post') {
            innerSpan.textContent = 'Post as ' + handle;
            button.dataset.xcoachHandleApplied = 'true';
        }
    });
}

function initPostButtonModifier() {
    let cachedHandle = null;
    let debounceTimer = null;
    let lastUrl = location.href;

    function processDOM() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            cachedHandle = null;
        }
        if (!cachedHandle) cachedHandle = getCurrentHandle();
        if (cachedHandle) modifyPostButtons(cachedHandle);
    }

    const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processDOM, 300);
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
        processDOM();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
            processDOM();
        });
    }
}
// End Post button modifier ------

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
