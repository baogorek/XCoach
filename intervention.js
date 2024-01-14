function updateCountDisplay() {
    const countSpan = document.getElementById('count');
    chrome.storage.local.get('XVisitCount', function(data) {
        countSpan.textContent = data.XVisitCount || 0;
    });
}

function resetCountIfNewDay() {
    const today = new Date().toDateString();
    chrome.storage.local.get('lastVisitDate', function(data) {
        if (data.lastVisitDate !== today) {
            console.log("data.lastVisitDate !== today")
            chrome.storage.local.set({ 'XVisitCount': 0, 'lastVisitDate': today });
            updateCountDisplay();
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    resetCountIfNewDay();
    updateCountDisplay();

    const button = document.getElementById('proceedToX');

    button.addEventListener('click', function() {
        chrome.storage.local.get('XVisitCount', function(data) {
            let currentCount = data.XVisitCount || 0;
            currentCount++;
            chrome.storage.local.set({ 'XVisitCount': currentCount }, function() {
                updateCountDisplay();
                const timeLimit = parseInt(document.getElementById('timeLimit').value, 10) || 15
                chrome.runtime.sendMessage({ action: "allowXAccess", timeLimit: timeLimit});
            });
        });
    });
});
