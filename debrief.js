document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('XVisitCount', function(data) {
        let visitCount = data.XVisitCount || 0;
        document.getElementById('count').textContent = visitCount;
    });
    chrome.storage.local.get('XVisitMinutes', function(data) {
        let visitMinutes = data.XVisitMinutes || 0;
        document.getElementById('minutes').textContent = visitMinutes;
    });
});

