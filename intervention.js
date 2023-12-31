function resetDailyCount() {
    const today = new Date().toDateString();
    chrome.storage.local.get('lastVisitDate', function(data) {
        if (data.lastVisitDate !== today) {
            chrome.storage.local.set({ 'XVisitCount': 0, 'lastVisitDate': today });
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('proceedToX');
    const countSpan = document.getElementById('count');

    resetDailyCount();

    function updateCountDisplay() {
        chrome.storage.local.get('XVisitCount', function(data) {
            countSpan.textContent = data.XVisitCount || 0;
        });
    }
    button.addEventListener('click', function() {
        chrome.storage.local.get('XVisitCount', function(data) {
            let currentCount = data.XVisitCount || 0;
            currentCount++;
            chrome.storage.local.set({ 'XVisitCount': currentCount }, function() {
                updateCountDisplay();
                // Send message to background script to proceed to X
                chrome.runtime.sendMessage({ action: "allowXAccess" });
            });
        });
    });
    updateCountDisplay();
});
