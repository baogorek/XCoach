document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get('XVisitCount', function(data) {
        let visitCount = data.XVisitCount || 0;
        document.getElementById('count').textContent = visitCount;
    });
    chrome.storage.local.get('XVisitSeconds', function(data) {
        let visitSeconds = data.XVisitSeconds || 0;
        document.getElementById('minutes').textContent = Math.round(visitSeconds / 60);
    });
});

