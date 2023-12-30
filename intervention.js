document.getElementById('proceedToX').addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: "allowXAccess" });
});
