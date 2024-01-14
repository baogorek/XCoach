// wait.js
function startCountdown(duration, display) {
    let timer = duration, minutes, seconds;
    let countdownInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
    return countdownInterval;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "warnClose") {
        // ... existing banner creation code ...

        let countdownDisplay = document.createElement('span');
        countdownDisplay.style.marginLeft = '15px';
        warningBanner.appendChild(countdownDisplay);

        let countdown = startCountdown(15 * 60, countdownDisplay); // 15 minutes

        // Snooze button
        let snoozeBtn = document.createElement('button');
        snoozeBtn.innerText = 'Snooze (1 min)';
        snoozeBtn.style.marginLeft = '15px';
        snoozeBtn.onclick = function() {
            clearInterval(countdown);
            chrome.runtime.sendMessage({ action: "snooze", tabId: sender.tab.id }, function(response) {
                if (response && response.timeLeft) {
                    countdown = startCountdown(Math.floor(response.timeLeft / 1000), countdownDisplay);
                }
            });
            warningBanner.remove();
        };
        warningBanner.appendChild(snoozeBtn);

        document.body.appendChild(warningBanner);
    }
});

