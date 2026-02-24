// --- Navigation ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + '-screen').classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.dataset.screen === screenId) l.classList.add('active');
    });

    // Update mobile nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === screenId) item.classList.add('active');
    });
}

// Function to set active mobile nav item
function setActiveMobileNav(element) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen(link.dataset.screen);
        });
    });

    // Period selector buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.parentElement.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Render Home Page Recent
    renderRecentWorkouts();
});

// --- Home Page Logic ---
function renderRecentWorkouts() {
    const container = document.getElementById('recent-workouts-container');
    if (!container) return;

    container.innerHTML = '';

    // Take last 10, assuming workouts are sorted new to old.
    // User requested "10 последних".
    // Let's sort workouts by date desc (just in case) and take 10.
    const recent = workouts.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Нет тренировок</div>';
        return;
    }

    recent.forEach(w => {
        const card = document.createElement('div');
        card.className = 'workout-card';
        card.onclick = () => {
            openWorkoutDetails(w.id);
        };

        const dateObj = new Date(w.date);
        const options = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        // Russian month manually or toLocaleString with 'ru-RU' which is standard
        // User asked "10 фев", let's use short month? Or full? Mockup had "10 фев".
        const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        let blocksHtml = '';
        if (w.skill) {
            blocksHtml += `
                <div class="workout-block skill">
                    <div class="block-title">🏋️ Skill: ${w.skill.name}</div>
                     <div class="workout-details">
                        ${w.skill.sets ? `<span class="detail-item">${w.skill.sets} подходов</span>` : ''}
                        ${w.skill.weight ? `<span class="detail-item">Max: ${Math.max(...w.skill.weight)} кг</span>` : ''}
                    </div>
                </div>`;
        }
        if (w.wod) {
            blocksHtml += `
                <div class="workout-block wod">
                    <div class="block-title">⚡ WOD: ${w.wod.name}</div>
                     <div class="workout-footer">
                        <span class="result-time">⏱ ${w.wod.result} (${w.wod.level})</span>
                    </div>
                </div>`;
        }

        card.innerHTML = `
            <div class="workout-header">
                <div class="workout-date">${dateStr}</div>
            </div>
            <div class="workout-blocks">
                ${blocksHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

// --- Workout Builder ---
function addSkillBlock() {
    const template = document.getElementById('skill-block-template');
    const clone = template.content.cloneNode(true);
    const container = document.getElementById('workout-builder');

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    container.appendChild(clone);
}

function addWodBlock() {
    const template = document.getElementById('wod-block-template');
    const clone = template.content.cloneNode(true);
    const container = document.getElementById('workout-builder');

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    container.appendChild(clone);
}

// --- Sets Logic ---
function updateSetsInputs(selectElement) {
    const count = parseInt(selectElement.value);
    const repsContainer = selectElement.closest('.form-group').nextElementSibling.querySelector('.sets-inputs-container');

    // Also update weight inputs container (next form-group)
    const weightFormGroup = selectElement.closest('.form-group').nextElementSibling.nextElementSibling;
    const weightContainer = weightFormGroup ? weightFormGroup.querySelector('.weight-inputs-container') : null;

    // Update reps inputs
    repsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-input set-input';
        input.placeholder = (i + 1).toString();
        repsContainer.appendChild(input);
    }

    // Update weight inputs if container exists
    if (weightContainer) {
        weightContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-input set-input';
            input.placeholder = (i + 1).toString();
            weightContainer.appendChild(input);
        }
    }
}

// --- Skill Exercise Dropdown ---
function showExerciseDropdown(inputElement) {
    const dropdown = inputElement.nextElementSibling;
    dropdown.classList.add('active');
    dropdown.style.display = 'block';

    // Filter on input
    inputElement.addEventListener('input', () => {
        const value = inputElement.value.toLowerCase();
        const items = dropdown.querySelectorAll('.autocomplete-item');

        items.forEach(item => {
            if (item.textContent.toLowerCase().includes(value)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Hide on blur
    inputElement.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.remove('active');
            dropdown.style.display = 'none';
        }, 200);
    });
}

function selectExercise(item, name, weight, date) {
    const wrapper = item.closest('.form-group');
    const input = wrapper.querySelector('input');
    const hint = wrapper.querySelector('.history-hint');
    const dropdown = wrapper.querySelector('.autocomplete-dropdown');

    input.value = name;
    dropdown.classList.remove('active');
    dropdown.style.display = 'none';

    // Show history hint if exists
    if (weight && weight !== 'null' && weight !== null) {
        hint.textContent = `ℹ️ В прошлый раз: ${weight} кг (${date})`;
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

// --- WOD Exercise Logic ---
const CARDIO_EXERCISES = ['Bike', 'Row', 'Run', 'SkiErg', 'Assault Bike', 'Гребля', 'Велотренажер', 'Бег', 'Лыжный тренажер'];

// --- WOD Logic ---
let isLadderMode = false;
let ladderRounds = 5; // Default to 5

function toggleLadderMode(checkbox) {
    isLadderMode = checkbox.checked;
    const roundsContainer = checkbox.closest('.container').querySelector('.ladder-rounds-container');

    if (isLadderMode) {
        roundsContainer.style.display = 'block';
        document.querySelectorAll('.wod-exercise-row').forEach(row => row.classList.add('ladder-mode'));
    } else {
        roundsContainer.style.display = 'none';
        document.querySelectorAll('.wod-exercise-row').forEach(row => row.classList.remove('ladder-mode'));
        // Do NOT reset ladderRounds to support persistence
    }
    updateAllExerciseRows();
}

function updateLadderRounds(select) {
    ladderRounds = parseInt(select.value) || 5;
    updateAllExerciseRows();
}

function updateAllExerciseRows() {
    const rows = document.querySelectorAll('.wod-exercise-row');
    rows.forEach(row => {
        updateExerciseRowVisibility(row);
        if (isLadderMode) {
            updateExerciseRowLadderInputs(row);
        }
    });
}

function updateExerciseRowVisibility(row) {
    const singleContainer = row.querySelector('.single-reps-container');
    const ladderContainer = row.querySelector('.ladder-reps-container');

    if (isLadderMode) {
        // Force hide single, force show ladder
        singleContainer.style.setProperty('display', 'none', 'important');
        ladderContainer.style.setProperty('display', 'flex', 'important');
    } else {
        // Force show single, force hide ladder
        singleContainer.style.setProperty('display', 'flex', 'important');
        ladderContainer.style.setProperty('display', 'none', 'important');
    }
}

function updateExerciseRowLadderInputs(row) {
    const container = row.querySelector('.ladder-reps-container');
    if (!container) return;

    // Get existing inputs
    const existingInputs = container.querySelectorAll('input');
    const currentCount = existingInputs.length;

    if (currentCount < ladderRounds) {
        // Add needed inputs
        for (let i = currentCount; i < ladderRounds; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-input-sm';
            input.placeholder = `Р${i + 1}`;
            // Styles handled by CSS class .ladder-reps-container input
            container.appendChild(input);
        }
    } else if (currentCount > ladderRounds) {
        // Remove excess inputs
        for (let i = currentCount - 1; i >= ladderRounds; i--) {
            existingInputs[i].remove();
        }
    }
}

function updateResultInput(select) {
    const input = select.nextElementSibling;
    if (select.value === 'time') {
        input.placeholder = '15:21';
    } else {
        input.placeholder = '187';
    }
}

function showWodExerciseDropdown(inputElement) {
    // Create dropdown if doesn't exist
    let dropdown = inputElement.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('autocomplete-dropdown')) {
        dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        // Exercise list in Russian
        const exercises = [
            'Трастеры (Thrusters)', 'Подтягивания (Pull-ups)', 'Отжимания (Push-ups)',
            'Берпи (Burpees)', 'Запрыгивания на коробку (Box Jumps)', 'Броски мяча (Wall Balls)',
            'Гребля (Row)', 'Велотренажер (Bike)', 'Бег (Run)', 'Взятие на грудь (Clean)',
            'Рывок (Snatch)', 'Становая тяга (Deadlift)', 'Приседания (Squats)',
            'Выходы на кольцах (Ring Muscle-ups)', 'Выходы на перекладине (Bar Muscle-ups)'
        ];

        dropdown.innerHTML = exercises.map(ex =>
            `<div class="autocomplete-item" onclick="selectWodExercise(this, '${ex}')">${ex}</div>`
        ).join('');

        inputElement.parentElement.insertBefore(dropdown, inputElement.nextSibling);
    }

    dropdown.classList.add('active');
    dropdown.style.display = 'block';

    // Hide on blur
    inputElement.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.remove('active');
            dropdown.style.display = 'none';
        }, 200);
    });
}

function filterWodDropdown(inputElement) {
    const dropdown = inputElement.nextElementSibling;
    if (!dropdown) return;

    const value = inputElement.value.toLowerCase();
    const items = dropdown.querySelectorAll('.autocomplete-item');
    let hasVisible = false;

    items.forEach(item => {
        if (item.textContent.toLowerCase().includes(value)) {
            item.style.display = 'block';
            hasVisible = true;
        } else {
            item.style.display = 'none';
        }
    });

    if (hasVisible) {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function selectWodExercise(item, name) {
    const row = item.closest('.wod-exercise-row');
    const input = row.querySelector('.wod-exercise-name');
    const weightInput = row.querySelector('.wod-weight');
    const dropdown = item.parentElement;

    input.value = name;
    dropdown.classList.remove('active');
    dropdown.style.display = 'none';

    // Hide weight field for cardio exercises
    const isCardio = CARDIO_EXERCISES.some(ex => name.toLowerCase().includes(ex.toLowerCase()));

    if (isCardio) {
        if (weightInput) {
            weightInput.style.display = 'none';
            row.classList.add('no-weight');
        }
        // Change reps placeholder to "cal"
        const repsInputs = row.querySelectorAll('.reps-container input'); // This might need update if we used single-reps-container
        // Better: look for all inputs in both containers
        const allRepsInputs = row.querySelectorAll('.single-reps-container input, .ladder-reps-container input');
        allRepsInputs.forEach(input => input.placeholder = 'Cal');
    } else {
        if (weightInput) {
            weightInput.style.display = 'block';
            row.classList.remove('no-weight');
        }
        // Restore placeholder
        const allRepsInputs = row.querySelectorAll('.single-reps-container input, .ladder-reps-container input');
        allRepsInputs.forEach(input => {
            if (input.parentElement.classList.contains('single-reps-container')) {
                input.placeholder = 'Повт.';
            } else {
                // For ladder, placeholder is P1, P2... don't change it back to 'Повт.'
                // Only if it was 'Cal' maybe? But ladder inputs are created dynamically with P{i}.
                // So we only need to care if they were set to Cal.
                // But for ladder, usually we don't change placeholder to Cal?
                // Actually cardio in ladder mode...
                if (input.placeholder === 'Cal') {
                    // reset? Hard to know original P{i} without re-rendering.
                    // But updateExerciseRowLadderInputs sets the placeholder.
                }
            }
        });

        // If we switch back from cardio, we might want to refresh ladder inputs to restore P{i}
        if (isLadderMode) {
            updateExerciseRowLadderInputs(row);
        } else {
            const singleInput = row.querySelector('.single-reps-container input');
            if (singleInput) singleInput.placeholder = 'Повт.';
        }
    }
}

function addWodExerciseRow(button) {
    const container = button.previousElementSibling;
    const newRow = document.createElement('div');
    newRow.className = 'wod-exercise-row';
    newRow.innerHTML = `
        <div class="wod-row-scroller">
            <input type="text" class="form-input-sm wod-exercise-name" placeholder="Упражнение" onfocus="showWodExerciseDropdown(this)" oninput="filterWodDropdown(this)">
            
            <div class="wod-fields-scroll">
                <div class="single-reps-container" style="display: flex;">
                    <input type="number" class="form-input-sm" placeholder="Повт.">
                </div>

                <div class="ladder-reps-container" style="display: none; gap: 0.5rem;">
                    <!-- Reps inputs will be injected here -->
                </div>

                <input type="number" class="form-input-sm wod-weight" placeholder="Вес, кг">
            </div>
        </div>
        <button class="btn-icon" onclick="removeWodExercise(this)">❌</button>
    `;
    container.appendChild(newRow);

    // Initialize state
    updateExerciseRowVisibility(newRow);
    if (isLadderMode) {
        newRow.classList.add('ladder-mode');
        updateExerciseRowLadderInputs(newRow);
    }
}

function removeWodExercise(button) {
    const row = button.closest('.wod-exercise-row');
    const container = row.parentElement;

    // Don't remove if it's the last row
    if (container.children.length > 1) {
        row.remove();
    } else {
        alert('Должно быть хотя бы одно упражнение');
    }
}

// --- Date Picker Logic ---
let datePickerState = {
    isOpen: false,
    currentDate: new Date(),
    displayedDate: new Date(), // First month of the 3-month view
    startDate: null,
    endDate: null,
    selectedPreset: 'custom'
};

function toggleDatePicker() {
    const modal = document.getElementById('date-picker-modal');
    datePickerState.isOpen = !datePickerState.isOpen;

    if (datePickerState.isOpen) {
        modal.classList.add('active');
        renderCalendar();
    } else {
        modal.classList.remove('active');
    }
}

function changeMonth(delta) {
    // Limit navigation? For demo, let's just allow it.
    // User requirement: "Arrow right disappears if last existing month (current) is shown"
    // "Arrow left disappears if no earlier records" -> we can mock this limit or ignore for MVP.

    const newDate = new Date(datePickerState.displayedDate);
    newDate.setMonth(newDate.getMonth() + delta);

    const today = new Date();
    // Prevent going too far into future (if 3rd month is future?)
    // Logic: displayedDate is the LEFT month. So displayed + 2 months is the rightmost.
    // If displayed + 2 > today, maybe allow? Usually history goes up to today.
    // Let's allow navigating back freely, but limit future?

    datePickerState.displayedDate = newDate;
    renderCalendar();
}

function selectDatePreset(preset) {
    datePickerState.selectedPreset = preset;

    // Update UI active state
    document.querySelectorAll('.preset-btn').forEach(btn => {
        if (btn.dataset.range === preset || btn.textContent.toLowerCase() === getPresetName(preset).toLowerCase()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    switch (preset) {
        case 'today':
            break; // start/end are today
        case 'yesterday':
            start.setDate(today.getDate() - 1);
            end.setDate(today.getDate() - 1);
            break;
        case 'week':
            // Current week (Mon-Sun) or last 7 days? Usually "This Week"
            const day = today.getDay() || 7; // 1 (Mon) - 7 (Sun)
            start.setDate(today.getDate() - day + 1);
            break;
        case 'month':
            start.setDate(1);
            break;
        case 'quarter':
            // User requested "last 4 months (quarter)" - interpreted as last 3 months back from today
            start.setMonth(today.getMonth() - 3);
            break;
        case 'custom':
            return; // Don't change dates, just mode
    }

    if (preset !== 'custom') {
        datePickerState.startDate = start;
        datePickerState.endDate = end;
        renderCalendar(); // Re-render to show selection
    }
}

function getPresetName(preset) {
    const map = {
        'today': 'Сегодня', 'yesterday': 'Вчера', 'week': 'Неделя',
        'month': 'Месяц', 'quarter': 'Квартал', 'custom': 'Период'
    };
    return map[preset] || preset;
}

function selectDate(dateStr) {
    const date = new Date(dateStr);

    // Switch to custom mode if clicking on calendar
    if (datePickerState.selectedPreset !== 'custom') {
        selectDatePreset('custom');
    }

    if (!datePickerState.startDate || (datePickerState.startDate && datePickerState.endDate)) {
        // Start new range
        datePickerState.startDate = date;
        datePickerState.endDate = null;
    } else {
        // Complete range
        if (date < datePickerState.startDate) {
            datePickerState.endDate = datePickerState.startDate;
            datePickerState.startDate = date;
        } else {
            datePickerState.endDate = date;
        }
    }
    renderCalendar();
    // DO NOT close calendar here - let user click Apply or Cancel
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '';

    // Render 3 months: displayed, displayed+1, displayed+2
    for (let i = 0; i < 3; i++) {
        const monthDate = new Date(datePickerState.displayedDate);
        monthDate.setMonth(monthDate.getMonth() + i);
        container.appendChild(createMonthElement(monthDate));
    }

    updateNavButtons();
}

function createMonthElement(date) {
    const monthDiv = document.createElement('div');
    monthDiv.className = 'calendar-month';

    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

    monthDiv.innerHTML = `
        <div class="month-title">${monthNames[date.getMonth()]} ${date.getFullYear()}</div>
        <div class="calendar-header">
            <div class="weekday-label">Пн</div>
            <div class="weekday-label">Вт</div>
            <div class="weekday-label">Ср</div>
            <div class="weekday-label">Чт</div>
            <div class="weekday-label">Пт</div>
            <div class="weekday-label">Сб</div>
            <div class="weekday-label">Вс</div>
        </div>
        <div class="calendar-days-grid"></div>
    `;

    const grid = monthDiv.querySelector('.calendar-days-grid');

    // Days generation
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay() || 7; // 1-7
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();

    // Empty cells before
    for (let i = 1; i < firstDayOfMonth; i++) {
        const empty = document.createElement('div');
        empty.className = 'day-cell empty';
        grid.appendChild(empty);
    }

    // Days
    for (let d = 1; d <= lastDateOfMonth; d++) {
        const cellDate = new Date(year, month, d);
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.textContent = d;

        // Check selection
        const time = cellDate.getTime();
        const start = datePickerState.startDate ? datePickerState.startDate.setHours(0, 0, 0, 0) : 0;
        const end = datePickerState.endDate ? datePickerState.endDate.setHours(23, 59, 59, 999) : 0;

        cellDate.setHours(0, 0, 0, 0);
        const cellTime = cellDate.getTime();

        if (datePickerState.startDate && cellTime === start) {
            cell.classList.add('range-start', 'selected');
        } else if (datePickerState.endDate && cellTime === datePickerState.endDate.setHours(0, 0, 0, 0)) {
            cell.classList.add('range-end', 'selected');
        } else if (start && end && cellTime > start && cellTime < end) {
            cell.classList.add('range-between');
        }

        // Indicators
        const dayWorkouts = workouts ? workouts.filter(w => {
            const wDate = new Date(w.date);
            return wDate.getDate() === d && wDate.getMonth() === month && wDate.getFullYear() === year;
        }) : [];

        if (dayWorkouts.length > 0) {
            const hasSkill = dayWorkouts.some(w => w.type === 'skill' || w.type === 'mixed');
            const hasWod = dayWorkouts.some(w => w.type === 'wod' || w.type === 'mixed');

            const dotContainer = document.createElement('div');
            dotContainer.className = 'indicators';
            dotContainer.style.position = 'absolute';
            dotContainer.style.bottom = '2px';
            dotContainer.style.display = 'flex';
            dotContainer.style.gap = '2px';

            if (hasSkill) {
                const dot = document.createElement('div');
                dot.style.width = '4px'; dot.style.height = '4px'; dot.style.borderRadius = '50%'; dot.style.background = '#00ff9d';
                dotContainer.appendChild(dot);
            }
            if (hasWod) {
                const dot = document.createElement('div');
                dot.style.width = '4px'; dot.style.height = '4px'; dot.style.borderRadius = '50%'; dot.style.background = '#ff4d4d';
                dotContainer.appendChild(dot);
            }
            cell.style.position = 'relative';
            cell.appendChild(dotContainer);
        }

        cell.onclick = (e) => {
            e.stopPropagation();
            selectDate(cellDate);
        };
        grid.appendChild(cell);
    }

    return monthDiv;
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

function updateNavButtons() {
    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');

    // Check limits if needed. For now, just simplistic check against today for nextBtn?
    // "Arrow right disappears if already shown last existing month (current)"
    // If displayedDate + 2 months is >= current month?

    const today = new Date();
    const lastShownMonth = new Date(datePickerState.displayedDate);
    lastShownMonth.setMonth(lastShownMonth.getMonth() + 2);

    if (lastShownMonth.getFullYear() > today.getFullYear() ||
        (lastShownMonth.getFullYear() === today.getFullYear() && lastShownMonth.getMonth() >= today.getMonth())) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0'; // Hide as requested "disappears"
    } else {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
    }
}

function applyDateFilter() {
    const btnText = document.getElementById('date-filter-text');
    let text = 'Период';
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    // Refine text generation
    if (datePickerState.selectedPreset === 'today') {
        const options = { day: 'numeric', month: 'short' };
        text = `Сегодня (${today.toLocaleDateString('ru-RU', options)})`;
    } else if (datePickerState.selectedPreset === 'yesterday') {
        const options = { day: 'numeric', month: 'short' };
        text = `Вчера (${yesterday.toLocaleDateString('ru-RU', options)})`;
    } else if (datePickerState.startDate && datePickerState.endDate) {
        const startYear = datePickerState.startDate.getFullYear();
        const endYear = datePickerState.endDate.getFullYear();
        const currentYear = today.getFullYear();

        const sDay = datePickerState.startDate.getDate();
        const sMonth = datePickerState.startDate.toLocaleString('ru-RU', { month: 'short' });
        const eDay = datePickerState.endDate.getDate();
        const eMonth = datePickerState.endDate.toLocaleString('ru-RU', { month: 'short' });

        let str = `${sDay} ${sMonth}`;
        if (startYear !== currentYear) str += ` ${startYear}`;
        str += ` - ${eDay} ${eMonth}`;
        if (endYear !== currentYear) str += ` ${endYear}`;

        text = str;
    } else if (datePickerState.startDate) {
        const year = datePickerState.startDate.getFullYear();
        text = `${datePickerState.startDate.getDate()} ${datePickerState.startDate.toLocaleString('ru-RU', { month: 'short' })}` + (year !== today.getFullYear() ? ` ${year}` : '');
    }

    btnText.textContent = text;
    // Do NOT close calendar here - it should close via Cancel/Apply button onclick

    if (typeof renderHistory === 'function') renderHistory();
}


// --- History Logic ---
let workouts = [
    {
        id: 1, date: new Date().toISOString(), type: 'mixed',
        skill: { name: 'Back Squat', sets: 5, reps: [5, 5, 5, 5, 5], weight: [100, 105, 110, 115, 120] },
        wod: { name: 'Fran', result: '8:45', level: 'rx', exercises: [{ name: 'Thrusters', reps: 21, weight: 43 }, { name: 'Pull-ups', reps: 21 }] }
    },
    {
        id: 2, date: new Date(Date.now() - 86400000).toISOString(), type: 'skill',
        skill: { name: 'Snatch', sets: 10, reps: [1], weight: [60] } // specific simplified data
    },
    // Generate more mock data for pagination
    ...Array.from({ length: 15 }, (_, i) => ({
        id: i + 3,
        date: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
        type: i % 2 === 0 ? 'wod' : 'skill',
        wod: i % 2 === 0 ? { name: `WOD ${i}`, result: '12:00', level: 'sc' } : null,
        skill: i % 2 !== 0 ? { name: `Skill ${i}`, sets: 3, reps: [10, 10, 10] } : null
    }))
];

const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let currentHistoryFilter = 'all'; // all, skill, wod

function startNewWorkout() {
    showScreen('create');
    // Reset forms?
    document.getElementById('workout-builder').innerHTML = `
        <div class="empty-state" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Пока пусто. Добавьте блок Skill или WOD.
        </div>
    `;
    // Maybe set date to now?
}

function renderHistory(page = 1) {
    const container = document.getElementById('history-container');
    const paginationContainer = document.getElementById('pagination-container');

    container.innerHTML = '';
    currentPage = page;

    // Filter
    let filtered = workouts.filter(w => {
        if (currentHistoryFilter === 'all') return true;
        return w.type === currentHistoryFilter || w.type === 'mixed';
    });

    // Date Filter
    if (datePickerState.startDate) {
        filtered = filtered.filter(w => {
            const d = new Date(w.date);
            const start = datePickerState.startDate;
            const end = datePickerState.endDate || datePickerState.startDate; // single day range
            // Reset times for comparison
            const dTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const sTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
            const eTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
            return dTime >= sTime && dTime <= eTime;
        });
    }

    // Pagination
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, end);
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

    if (pageItems.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align:center; padding: 2rem; color: var(--text-secondary);">Нет тренировок за выбранный период</div>';
        paginationContainer.innerHTML = '';
        return;
    }

    pageItems.forEach(w => {
        const card = document.createElement('div');
        card.className = 'workout-card';
        card.onclick = (e) => {
            // Prevent if clicking on specific interactive elements if any
            openWorkoutDetails(w.id);
        };

        const dateObj = new Date(w.date);
        const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        let blocksHtml = '';
        if (w.skill) {
            blocksHtml += `
                <div class="workout-block skill">
                    <div class="block-title">🏋️ Skill: ${w.skill.name}</div>
                </div>`;
        }
        if (w.wod) {
            blocksHtml += `
                <div class="workout-block wod">
                    <div class="block-title">⚡ WOD: ${w.wod.name}</div>
                </div>`;
        }

        card.innerHTML = `
            <div class="workout-header">
                <div class="workout-date">${dateStr}</div>
            </div>
            <div class="workout-blocks">
                ${blocksHtml}
            </div>
        `;
        container.appendChild(card);
    });

    // Render Pagination Controls - NEW LOGIC
    renderPagination(totalPages, page);
}

function renderPagination(totalPages, currentPage) {
    const container = document.getElementById('pagination-container');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    const createBtn = (text, page, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${isActive ? 'active' : ''}`;
        btn.textContent = text;
        if (isDisabled) {
            btn.disabled = true;
            btn.style.cursor = 'default';
        } else {
            btn.onclick = () => renderHistory(page);
        }
        return btn;
    };

    // Prev
    if (currentPage > 1) {
        container.appendChild(createBtn('Пред.', currentPage - 1));
    }

    // Pages logic
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            container.appendChild(createBtn(i, i, i === currentPage));
        }
    } else {
        // ALWAYS show 1, 2
        container.appendChild(createBtn(1, 1, 1 === currentPage));
        container.appendChild(createBtn(2, 2, 2 === currentPage));

        if (currentPage > 2 && currentPage < totalPages - 1) {
            container.appendChild(createBtn('...', null, false, true)); // separator
            // Show current if it's not 1, 2, N-1, N. (Actually loop above covers 1,2).
            // Wait, if current is 3. 1, 2, 3...
            // If current is 3, logic `currentPage > 2` is true. `currentPage < totalPages - 1` (say 10) is true.
            // We start straight with ...?
            // Should we check if there is a gap?
            if (currentPage > 3) {
                // Gap between 2 and current
            }

            container.appendChild(createBtn(currentPage, currentPage, true));

            if (currentPage < totalPages - 2) {
                // Gap between current and N-1
            }
            container.appendChild(createBtn('...', null, false, true)); // separator
        } else {
            container.appendChild(createBtn('...', null, false, true)); // separator
        }

        container.appendChild(createBtn(totalPages - 1, totalPages - 1, totalPages - 1 === currentPage));
        container.appendChild(createBtn(totalPages, totalPages, totalPages === currentPage));
    }

    // Next
    if (currentPage < totalPages) {
        container.appendChild(createBtn('След.', currentPage + 1));
    }
}

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    // ... existing listeners ...
    if (document.getElementById('history-container')) {
        renderHistory();
    }

    // Period buttons listeners
    document.querySelectorAll('.period-selector .period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const txt = e.target.textContent.toLowerCase();
            if (txt.includes('wod')) currentHistoryFilter = 'wod';
            else if (txt.includes('skill')) currentHistoryFilter = 'skill';
            else currentHistoryFilter = 'all';

            // UI update handled by general listener or manually here
            e.target.parentElement.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            renderHistory();
        });
    });

    // Close date picker on outside click
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('date-picker-modal');
        const btn = document.getElementById('date-filter-btn');
        if (datePickerState.isOpen && modal && !modal.contains(e.target) && !btn.contains(e.target)) {
            toggleDatePicker();
        }
    });
});

let currentWorkoutId = null;

function openWorkoutDetails(id) {
    const workout = workouts.find(w => w.id === id);
    if (!workout) return;

    currentWorkoutId = id;
    const content = document.getElementById('details-content');

    const dateObj = new Date(workout.date);
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let html = `
        <div class="workout-date" style="font-size: 1.2rem; margin-bottom: 2rem; color: var(--text-secondary);">${dateStr}</div>
    `;

    if (workout.skill) {
        let skillDetails = '';
        if (workout.skill.reps && workout.skill.weight) {
            skillDetails = workout.skill.reps.map((r, i) => `${r}x${workout.skill.weight[i] || '-'}kg`).join(', ');
        } else if (workout.skill.reps) {
            skillDetails = workout.skill.reps.join(', ');
        }

        html += `
            <div class="added-block skill-block" style="margin-bottom: 2rem;">
                <h3 class="block-title" style="color: var(--color-secondary); margin-bottom: 1rem;">🏋️ Skill: ${workout.skill.name}</h3>
                <div class="detail-row" style="margin-bottom: 0.5rem;">
                    <strong>Подходы:</strong> ${workout.skill.sets}
                </div>
                <div class="detail-row" style="margin-bottom: 0.5rem;">
                    <strong>Детали:</strong> ${skillDetails}
                </div>
            </div>`;
    }

    if (workout.wod) {
        let wodDetails = '';
        if (workout.wod.exercises) {
            wodDetails = workout.wod.exercises.map(ex => {
                return `${ex.name}: ${ex.reps ? ex.reps : ''} ${ex.weight ? '@ ' + ex.weight + 'kg' : ''}`;
            }).join('<br>');
        }

        html += `
            <div class="added-block wod-block">
                <h3 class="block-title" style="color: var(--color-primary); margin-bottom: 1rem;">⚡ WOD: ${workout.wod.name}</h3>
                <div class="detail-row" style="margin-bottom: 0.5rem;"><strong>Тип:</strong> ${workout.wod.level ? workout.wod.level.toUpperCase() : 'RX'}</div>
                <div class="detail-row" style="margin-bottom: 0.5rem;"><strong>Результат:</strong> ${workout.wod.result}</div>
                 ${wodDetails ? `<div class="detail-row" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">${wodDetails}</div>` : ''}
            </div>`;
    }

    content.innerHTML = html;
    showScreen('details');
}

function editCurrentWorkout() {
    if (!currentWorkoutId) return;
    const workout = workouts.find(w => w.id === currentWorkoutId);
    if (!workout) return;

    // Load into builder
    showScreen('create');
    const container = document.getElementById('workout-builder');

    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    container.innerHTML = '';

    if (workout.skill) {
        addSkillBlock();
        setTimeout(() => {
            const row = container.lastElementChild;
            if (row) {
                const input = row.querySelector('.exercise-search');
                if (input) input.value = workout.skill.name;
            }
        }, 100);
    }

    if (workout.wod) {
        addWodBlock();
        setTimeout(() => {
            const row = container.lastElementChild;
            if (row) {
                const input = row.querySelector('input[placeholder="Например: Fran"]');
                if (input) input.value = workout.wod.name;
            }
        }, 100);
    }
}

// Chart Logic
let myChart = null;

function initChart(ctx) {
    if (myChart) myChart.destroy();

    // Mock data based on selection
    const exerciseSelect = document.getElementById('chart-exercise-select');
    const detailSelect = document.getElementById('chart-detail-select');

    const exercise = exerciseSelect ? exerciseSelect.value : 'Back Squat';
    const detail = detailSelect ? detailSelect.value : 'month';

    // Generate data
    let labels = [];
    let data = [];

    const today = new Date();

    if (detail === 'day') {
        // Last 14 days
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
            data.push(100 + Math.floor(Math.random() * 20));
        }
    } else if (detail === 'week') {
        const currentYear = today.getFullYear();
        // Shift to Monday of current week
        const dayOfWeek = today.getDay() || 7;
        const currentWeekMonday = new Date(today);
        currentWeekMonday.setDate(today.getDate() - dayOfWeek + 1);

        // Last 12 weeks
        for (let i = 11; i >= 0; i--) {
            const start = new Date(currentWeekMonday);
            start.setDate(start.getDate() - (i * 7));

            const end = new Date(start);
            end.setDate(end.getDate() + 6);

            const sDay = start.getDate();
            const sMonth = start.toLocaleString('ru-RU', { month: 'short' });
            const sYear = start.getFullYear();

            const eDay = end.getDate();
            const eMonth = end.toLocaleString('ru-RU', { month: 'short' });
            const eYear = end.getFullYear();

            let label = `${sDay} ${sMonth} - ${eDay} ${eMonth}`;

            if (sMonth === eMonth && sYear === eYear) {
                label = `${sDay}-${eDay} ${sMonth}`;
            }

            // Year logic
            if (eYear !== currentYear) {
                // If end year is not current, show year.
                // If same year (fully in past year) -> show once at end? "25-31 дек 2024"
                if (sYear === eYear) {
                    label += ` ${eYear}`;
                } else {
                    // Cross year: "29 дек 2024 - 4 янв 2025"
                    label = `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
                }
            } else if (sYear !== currentYear) {
                // Starts in past year, ends in current.
                // "29 дек 2024 - 4 янв" (assuming current is 2025)
                label = `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth}`;
            }

            labels.push(label);
            data.push(100 + Math.floor(Math.random() * 30));
        }
    } else {
        // Months (Year)
        const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        const currentYear = today.getFullYear();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today);
            d.setMonth(d.getMonth() - i);
            const monthLabel = monthNames[d.getMonth()];
            const year = d.getFullYear();
            // Add year if not current year
            labels.push(year !== currentYear ? `${monthLabel} ${year}` : monthLabel);
            data.push(90 + i * 2 + Math.floor(Math.random() * 10));
        }
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Вес (кг) - ' + exercise,
                data: data,
                borderColor: '#ff3b30',
                backgroundColor: 'rgba(255, 59, 48, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: '#333'
                    },
                    ticks: {
                        color: '#a0a0a0'
                    }
                },
                x: {
                    grid: {
                        color: '#333'
                    },
                    ticks: {
                        color: '#a0a0a0'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            }
        }
    });
}

// Listeners for chart controls
document.addEventListener('DOMContentLoaded', () => {
    const chartExSelect = document.getElementById('chart-exercise-select');
    const chartDetSelect = document.getElementById('chart-detail-select');

    // Check if on stats screen initially or setup general listeners
    // The screen might not be visible, but elements exist.

    if (chartExSelect && chartDetSelect) {
        chartExSelect.addEventListener('change', () => {
            const ctx = document.getElementById('progress-chart');
            if (ctx) initChart(ctx);
        });
        chartDetSelect.addEventListener('change', () => {
            const ctx = document.getElementById('progress-chart');
            if (ctx) initChart(ctx);
        });
    }

    // Also init on load if stats screen is active? 
    // Or adds observer? For MVP, just init if element exists.
    const ctx = document.getElementById('progress-chart');
    if (ctx) {
        initChart(ctx);
    }

    // Re-init when showing stats screen
    const statsLink = document.querySelector('.nav-link[data-screen="stats"]');
    if (statsLink) {
        statsLink.addEventListener('click', () => {
            setTimeout(() => {
                const ctx = document.getElementById('progress-chart');
                if (ctx) initChart(ctx);
            }, 100);
        });
    }
});

// --- Custom Select Wrapper to match autocomplete-item styles ---
document.addEventListener('DOMContentLoaded', () => {
    function initCustomSelects(rootNode) {
        const selects = rootNode.querySelectorAll('select.form-select:not([data-custom-setup])');
        selects.forEach(select => {
            select.setAttribute('data-custom-setup', 'true');

            // Hide the original select
            select.style.display = 'none';

            // Create wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'custom-select-wrapper';
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';

            // Create trigger visible button
            const trigger = document.createElement('div');
            trigger.className = 'form-select custom-select-trigger';
            trigger.style.cursor = 'pointer';
            trigger.style.display = 'flex';
            trigger.style.justifyContent = 'space-between';
            trigger.style.alignItems = 'center';

            const textSpan = document.createElement('span');
            textSpan.className = 'custom-select-text';
            textSpan.textContent = select.options[select.selectedIndex]?.text || '';

            const arrowSpan = document.createElement('span');
            arrowSpan.className = 'custom-select-arrow';
            arrowSpan.textContent = '▼';
            arrowSpan.style.fontSize = '0.8rem';

            trigger.appendChild(textSpan);
            trigger.appendChild(arrowSpan);

            // Create dropdown container same as autocomplete-dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown custom-select-dropdown';
            dropdown.style.width = '100%';
            dropdown.style.maxHeight = '200px';
            dropdown.style.overflowY = 'auto';
            dropdown.style.zIndex = '10001'; // Ensure it is above other elements

            // Populate options
            Array.from(select.options).forEach((opt, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item custom-select-item';
                item.textContent = opt.text;
                if (opt.selected) {
                    item.style.backgroundColor = 'var(--bg-secondary)';
                    item.style.color = 'var(--color-primary)';
                }
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    select.selectedIndex = index;
                    // Trigger change event for original select
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    // Update trigger text
                    textSpan.textContent = opt.text;
                    // Update active styles
                    dropdown.querySelectorAll('.custom-select-item').forEach(i => {
                        i.style.backgroundColor = '';
                        i.style.color = '';
                    });
                    item.style.backgroundColor = 'var(--bg-secondary)';
                    item.style.color = 'var(--color-primary)';
                    // Close dropdown
                    dropdown.classList.remove('active');
                });
                dropdown.appendChild(item);
            });

            // Toggle dropdown
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close all other dropdowns
                document.querySelectorAll('.custom-select-dropdown.active').forEach(d => {
                    if (d !== dropdown) d.classList.remove('active');
                });
                dropdown.classList.toggle('active');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });

            wrapper.appendChild(trigger);
            wrapper.appendChild(dropdown);

            // Insert wrapper right after the select
            select.parentNode.insertBefore(wrapper, select.nextSibling);

            // Listen to programmatic changes to the original select
            select.addEventListener('change', () => {
                textSpan.textContent = select.options[select.selectedIndex]?.text || '';
                dropdown.querySelectorAll('.custom-select-item').forEach((i, idx) => {
                    if (idx === select.selectedIndex) {
                        i.style.backgroundColor = 'var(--bg-secondary)';
                        i.style.color = 'var(--color-primary)';
                    } else {
                        i.style.backgroundColor = '';
                        i.style.color = '';
                    }
                });
            });
        });
    }

    // Init existing
    initCustomSelects(document);

    // Observe for dynamically added selects
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element
                    if (node.tagName === 'SELECT' && node.classList.contains('form-select')) {
                        initCustomSelects(node.parentNode);
                    } else if (node.querySelectorAll) {
                        initCustomSelects(node);
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
