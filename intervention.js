console.log = function() {};

// Functions --------------------

function deletePriority(index) {
    chrome.storage.sync.get('priorities', function(data) {
        let priorities = data.priorities || [];
        if (index >= 0 && index < priorities.length) {
            priorities.splice(index, 1);
            chrome.storage.sync.set({'priorities': priorities}, function() {
                loadAndDisplayPriorities();
            });
        }
    });
}

function loadAndDisplayPriorities() {
    chrome.storage.sync.get('priorities', function(data) {
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
    chrome.storage.sync.get('priorities', function(data) {
        let priorities = data.priorities || [];
        if (priorities.length < 5) {
            priorities.push(priority);
            chrome.storage.sync.set({'priorities': priorities}, function() {
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


// Charting functions ---------

function formatDate(date) {
    return date.toLocaleDateString('en-CA'); // 'en-CA' gives the format YYYY-MM-DD
}

function generateDateSequence(startDate, numberOfDays) {
    const dates = [];
    for (let i = 0; i < numberOfDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() - i);
        dates.push(formatDate(date));
    }
    return dates.reverse();
}

function aggregateSessionTimes(callback) {
    chrome.storage.sync.get({ sessions: {} }, function(data) {
        const sessions = data.sessions;
        const aggregatedTimes = {};
        const currentDate = formatDate(new Date());

        if (Object.keys(sessions).length === 0) {
            // If there are no sessions, add a dummy session for the current date
            aggregatedTimes[currentDate] = 0;
        } else {
            // Reduce function to aggregate session times by date
            Object.entries(sessions).reduce((acc, [start, end]) => {
                const startDate = formatDate(new Date(parseInt(start)));
                const sessionDurationMinutes = (end - start) / (1000 * 60); // Duration in minutes

                if (!acc[startDate]) {
                    acc[startDate] = 0;
                }
                acc[startDate] += sessionDurationMinutes;
                return acc;
            }, aggregatedTimes);
        }

        if (!aggregatedTimes[currentDate]) {
            aggregatedTimes[currentDate] = 0;
        }

        console.log('Aggregated session times by date (in minutes):', aggregatedTimes);
        document.getElementById('minutes').innerText = aggregatedTimes[currentDate].toFixed(1);

        // Transform aggregatedTimes into arrays for Chart.js
        const dates = Object.keys(aggregatedTimes);
        const sessionDurations = Object.values(aggregatedTimes);

        callback(dates, sessionDurations);
    });
}

function createVisitMinutesChart(dates, sessionDurations) {
    const ctxVisitMinutes = document.getElementById('visitMinutesChart').getContext('2d');
    const targetDays = 5; // Minimum number of days to display
    const referenceValue = 60; // Arbitrary reference value for padding
    let meanLabel;
    const currentDate = formatDate(new Date());

    // Determine if there are enough days to calculate the mean
    if (dates.length >= targetDays) {
        meanLabel = "Mean Visit Duration";

        // Calculate mean excluding the current day if present
        let sumDurations = 0;
        let countDurations = 0;
        dates.forEach((date, index) => {
            if (date !== currentDate) {
                sumDurations += sessionDurations[index];
                countDurations++;
            }
        });
        const meanVisitDuration = countDurations > 0 ? sumDurations / countDurations : 0;
        
        // Create the reference value array for the mean
        const paddedReference = Array(dates.length).fill(meanVisitDuration);
        
        let visitMinutesChart = new Chart(ctxVisitMinutes, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Daily Visit Duration (minutes)',
                    data: sessionDurations,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: meanLabel,
                    data: paddedReference,
                    borderColor: 'rgb(255, 159, 64)',
                    borderDash: [5, 5], // Dotted line
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 1.05 * Math.max(...sessionDurations, meanVisitDuration)
                    }
                }
            }
        });
    } else {
        // Handle cases where there isn't enough data to display mean
        meanLabel = `Arbitrary Reference for First ${targetDays} Days`;

        console.log(dates);
        const additionalDates = generateDateSequence(new Date(dates[0]), targetDays - dates.length + 1).slice(1);
        console.log(additionalDates);

        paddedDateSequence = additionalDates.concat(dates);
        console.log(paddedDateSequence);  // looks right

        paddedDurations = Array(targetDays - sessionDurations.length).fill(null).concat(sessionDurations);
        paddedReference = Array(targetDays).fill(referenceValue);
        let visitMinutesChart = new Chart(ctxVisitMinutes, {
            type: 'line',
            data: {
                labels: paddedDateSequence,
                datasets: [{
                    label: 'Daily Visit Duration (minutes)',
                    data: paddedDurations,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: meanLabel,
                    data: paddedReference,
                    borderColor: 'rgb(255, 159, 64)',
                    borderDash: [5, 5], // Dotted line
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 1.05 * Math.max(...paddedDurations, referenceValue)
                    }
                }
            }
        });
    }
}


// Event Listeners -----------------------

document.addEventListener('DOMContentLoaded', async function() {
    // await compileAndStoreDailyDataAsync();

    const proceedToXButton = document.getElementById('proceedToX');
    const timeLimitInput = document.getElementById('timeLimit'); 

    proceedToXButton.addEventListener('click', function() {
        let timeLimit = parseInt(document.getElementById('timeLimit').value, 10);
        
        if (!isNaN(timeLimit) && timeLimit >= 2 && timeLimit <= 120) {
            chrome.runtime.sendMessage(
                {action: "allowXAccess", timeLimit: timeLimit},
                function(response) {console.log("proceedToX response:", response)} 
            );
        } else {
            alert('Session length must be between 2 to 120 minutes.');
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

    // Charting
    aggregateSessionTimes(createVisitMinutesChart);

    // Scratchpad
    const textarea = document.getElementById('scratchpad-textarea');

    // Load saved content
    chrome.storage.sync.get(['scratchpadContent'], function(result) {
        if (result.scratchpadContent) {
            textarea.value = result.scratchpadContent;
        }
        else {
            textarea.value = 'Type your notes or thoughts here...';
        }
    });

    // Save content on input
    textarea.addEventListener('input', function() {
        const content = textarea.value;
        chrome.storage.sync.set({ scratchpadContent: content }, function() {
            console.log('Scratchpad content saved:', content);
        });
    });
});
