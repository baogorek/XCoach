console.log = function() {};

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
    deleteBtn.textContent = 'Delete';
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
            chrome.runtime.sendMessage({ action: "allowXAccess", timeLimit: timeLimit});
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
// Assuming you have two canvas elements with these IDs in your HTML
var ctxVisitCount = document.getElementById('visitCountChart').getContext('2d');
var ctxVisitMinutes = document.getElementById('visitMinutesChart').getContext('2d');

chrome.storage.local.get('dailyData', function(data) {

    if (!data.dailyData || data.dailyData.length === 0) {
        console.log("No daily data available yet.");
        document.getElementById("noContentDiv").textContent = (
           "No data available yet. Start using X/Twitter and data will appear here."
        );
        return;
    }

    var dates = data.dailyData.map(entry => entry.date);
    var visitCounts = data.dailyData.map(entry => entry.XVisitCount);
    var visitMinutes = data.dailyData.map(entry => entry.XVisitSeconds / 60);

    // Find max values for scaling
    var maxVisitCount = Math.max(...visitCounts) * 1.1;
    var maxVisitMinutes = Math.max(...visitMinutes) * 1.1;

    // Calculate means
    var meanVisitCount = visitCounts.reduce((a, b) => a + b, 0) / visitCounts.length;
    var meanVisitMinutes = visitMinutes.reduce((a, b) => a + b, 0) / visitMinutes.length;

    // Create arrays of mean values for all labels
    var meanVisitCountArray = Array(dates.length).fill(meanVisitCount);
    var meanVisitMinutesArray = Array(dates.length).fill(meanVisitMinutes);

    // Create the Daily Visit Count Chart
    var visitCountChart = new Chart(ctxVisitCount, {
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
    var visitMinutesChart = new Chart(ctxVisitMinutes, {
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
