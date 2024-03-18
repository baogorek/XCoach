 console.log = function() {};

// Run every time intervention page is loaded ---
// There may be a smarter way to not have this in global code running unconditionally
// If the alarm never went off, wipe all alarms (which hopefully resets things)
// and trigger what was supposed to run by setting an alarm in the past
// Once the user proceeds to X, the alarm will be set again for the next midnight
chrome.alarms.get("compileDailyData", function(alarm) {
    if (alarm) {
        let now = new Date().getTime();
        if (alarm.scheduledTime < now) {
            console.log("compileDailyData alarm is stuck in the past, attempting to rectify.");
            chrome.alarms.clear();
            chrome.alarms.create("compileDailyData", { when: Date.now() - 5000 });  // In the past
        }
    }
});

// Functions --------------------

function updateCountDisplay() {
    const countSpan = document.getElementById('count');
    chrome.storage.local.get('XVisitCount', function(data) {
        countSpan.textContent = data.XVisitCount || 0;
    });
    chrome.storage.local.get('XVisitSeconds', function(data) {
        let visitSeconds = data.XVisitSeconds || 0;
        document.getElementById('minutes').textContent = (visitSeconds / 60).toFixed(1);
    });
}

function deletePriority(index) {
    chrome.storage.local.get('priorities', function(data) {
        let priorities = data.priorities || [];
        if (index >= 0 && index < priorities.length) {
            priorities.splice(index, 1);
            chrome.storage.local.set({'priorities': priorities}, function() {
                loadAndDisplayPriorities();
            });
        }
    });
}

function loadAndDisplayPriorities() {
    chrome.storage.local.get('priorities', function(data) {
        const priorities = data.priorities || [];
        priorityList.innerHTML = ''; // Clear current list
        priorities.forEach(function(priority, index) {
            addPriorityToList(priority, index);
        });

        const priorityForm = document.getElementById('priorityForm');
        if (priorities.length >= 5) {
            priorityForm.style.display = 'none';
        } else {
            priorityForm.style.display = '';
        }
    });
}

function addPriority(priority) {
    chrome.storage.local.get('priorities', function(data) {
        let priorities = data.priorities || [];
        if (priorities.length < 5) {
            priorities.push(priority);
            chrome.storage.local.set({'priorities': priorities}, function() {
                addPriorityToList(priority, priorities.length - 1);
                loadAndDisplayPriorities();
            });
        } else {
            alert('Maximum of 5 priorities reached.');
        }
    });
}

function addPriorityToList(priority, index) {
    const li = document.createElement('li');
    li.textContent = priority;
    priorityList.appendChild(li);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'x';
    deleteBtn.onclick = function() {
        deletePriority(index);
    };
    li.appendChild(deleteBtn);
    priorityList.appendChild(li);
}


document.addEventListener('DOMContentLoaded', function() {
    updateCountDisplay();

    const proceedToXButton = document.getElementById('proceedToX');
    const timeLimitInput = document.getElementById('timeLimit'); 

    proceedToXButton.addEventListener('click', function() {
        let timeLimit = parseInt(document.getElementById('timeLimit').value, 10);
        
        if (!isNaN(timeLimit) && timeLimit >= 2) {
            chrome.runtime.sendMessage(
                {action: "allowXAccess", timeLimit: timeLimit},
                function(response) {console.log("proceedToX response:", response)} 
            );
        } else {
            alert('Please enter a valid time limit of 2 minutes or more in whole number increments.');
        }
    });

    timeLimitInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            const timeLimitValue = parseInt(timeLimitInput.value, 10);
            proceedToXButton.click();
        }
    });

    // Priorities
    const priorityForm = document.getElementById('priorityForm');
    const newPriorityInput = document.getElementById('newPriority');
    const priorityList = document.getElementById('priorityList');


    priorityForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const newPriority = newPriorityInput.value.trim();
        if (newPriority) {
            addPriority(newPriority);
            newPriorityInput.value = '';
        }
    });
  
    loadAndDisplayPriorities();
});

// Charting ---------
chrome.storage.local.get('dailyData', function(data) {

    if (!data.dailyData || data.dailyData.length === 0) {
        console.log("No daily data available yet.");
        document.getElementById("visitCountGraphicsDiv").textContent = (
           "X / Twitter Visit Count history will appear soon!"
        );
        document.getElementById("visitMinutesGraphicsDiv").textContent = (
           "X / Twitter Visit Minutes history will appear soon!"
        );
        return;
    }

    let dates = data.dailyData.map(entry => entry.date);
    let visitCounts = data.dailyData.map(entry => entry.XVisitCount);
    let visitMinutes = data.dailyData.map(entry => entry.XVisitSeconds / 60);

    // Find max values for scaling
    let maxVisitCount = Math.max(...visitCounts) * 1.1;
    let maxVisitMinutes = Math.max(...visitMinutes) * 1.1;

    // Calculate means
    let meanVisitCount = visitCounts.reduce((a, b) => a + b, 0) / visitCounts.length;
    let meanVisitMinutes = visitMinutes.reduce((a, b) => a + b, 0) / visitMinutes.length;

    // Create arrays of mean values for all labels
    let meanVisitCountArray = Array(dates.length).fill(meanVisitCount);
    let meanVisitMinutesArray = Array(dates.length).fill(meanVisitMinutes);

    let ctxVisitCount = document.getElementById('visitCountChart').getContext('2d');
    let ctxVisitMinutes = document.getElementById('visitMinutesChart').getContext('2d');

    // Create the Daily Visit Count Chart
    let visitCountChart = new Chart(ctxVisitCount, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Visit Count',
                data: visitCounts,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }, {
                label: 'Mean Visit Count',
                data: meanVisitCountArray,
                borderColor: 'rgb(255, 159, 64)',
                borderDash: [5, 5], // Dotted line
                tension: 0.1
            }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxVisitCount
                }
            }
        }
    });

    // Create the Daily Visit Minutes Chart
    let visitMinutesChart = new Chart(ctxVisitMinutes, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Daily Visit Minutes',
                data: visitMinutes,
                borderColor: 'rgb(255, 99, 132)',
                tension: 0.1
            },
            {
                label: 'Mean Visit Minutes',
                data: meanVisitMinutesArray,
                borderColor: 'rgb(255, 159, 64)',
                borderDash: [5, 5], // Dotted line
                tension: 0.1
            }
        ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxVisitMinutes
                }
            }
        }

    });
});
