// Navigation between screens
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const screens = document.querySelectorAll('.screen');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetScreen = link.dataset.screen;

            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show target screen
            screens.forEach(screen => {
                screen.classList.remove('active');
                if (screen.id === `${targetScreen}-screen`) {
                    screen.classList.add('active');
                }
            });
        });
    });

    // Set first nav link as active
    navLinks[0].classList.add('active');

    // Type selector (Skill/WOD)
    const typeBtns = document.querySelectorAll('.type-btn');
    const skillForm = document.getElementById('skill-form');
    const wodForm = document.getElementById('wod-form');

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const type = btn.dataset.type;
            if (type === 'skill') {
                skillForm.classList.remove('hidden');
                wodForm.classList.add('hidden');
            } else {
                skillForm.classList.add('hidden');
                wodForm.classList.remove('hidden');
            }
        });
    });

    // Autocomplete simulation
    const exerciseInput = document.getElementById('exercise-input');
    const autocomplete = document.getElementById('autocomplete');

    const exercises = [
        'Back Squat',
        'Front Squat',
        'Overhead Squat',
        'Deadlift',
        'Sumo Deadlift',
        'Romanian Deadlift',
        'Bench Press',
        'Overhead Press',
        'Pull-ups',
        'Chest-to-bar Pull-ups',
        'Push-ups',
        'Burpees',
        'Box Jumps',
        'Wall Balls',
        'Kettlebell Swings',
        'Thrusters',
        'Clean and Jerk',
        'Snatch',
        'Muscle-ups',
        'Handstand Push-ups'
    ];

    exerciseInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase();
        if (value.length < 2) {
            autocomplete.classList.remove('active');
            return;
        }

        const filtered = exercises.filter(ex =>
            ex.toLowerCase().includes(value)
        );

        if (filtered.length > 0) {
            autocomplete.innerHTML = filtered
                .slice(0, 5)
                .map(ex => `<div class="autocomplete-item">${ex}</div>`)
                .join('');
            autocomplete.classList.add('active');

            // Add click handlers to autocomplete items
            document.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    exerciseInput.value = item.textContent;
                    autocomplete.classList.remove('active');
                });
            });
        } else {
            autocomplete.classList.remove('active');
        }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!exerciseInput.contains(e.target) && !autocomplete.contains(e.target)) {
            autocomplete.classList.remove('active');
        }
    });

    // Equipment selector
    const equipmentBtns = document.querySelectorAll('.equipment-btn');
    equipmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
        });
    });

    // Calendar day click
    const calendarDays = document.querySelectorAll('.calendar-day:not(.empty)');
    calendarDays.forEach(day => {
        day.addEventListener('click', () => {
            const dayNumber = day.querySelector('.day-number')?.textContent;
            if (dayNumber) {
                showWorkoutModal(dayNumber);
            }
        });
    });

    // Add exercise button
    const addExerciseBtn = document.querySelector('.btn-secondary');
    if (addExerciseBtn) {
        addExerciseBtn.addEventListener('click', () => {
            const exerciseList = document.querySelector('.exercise-list');
            const newExercise = document.createElement('div');
            newExercise.className = 'exercise-item';
            newExercise.innerHTML = `
                <input type="text" class="form-input-sm" placeholder="Упражнение">
                <input type="number" class="form-input-sm" placeholder="Вес">
                <input type="number" class="form-input-sm" placeholder="Повт.">
                <button class="btn-icon">❌</button>
            `;
            exerciseList.appendChild(newExercise);

            // Add remove handler
            newExercise.querySelector('.btn-icon').addEventListener('click', () => {
                newExercise.remove();
            });
        });
    }

    // Remove exercise buttons
    document.querySelectorAll('.exercise-item .btn-icon').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.exercise-item').remove();
        });
    });

    // Save workout button animations
    const saveBtns = document.querySelectorAll('.btn-primary');
    saveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Simulate save with animation
            const originalText = btn.textContent;
            btn.textContent = '✓ Сохранено!';
            btn.style.background = 'linear-gradient(135deg, #30ff88, #ffbd00)';

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);

            // Show celebration animation
            showCelebration();
        });
    });
});

function showWorkoutModal(day) {
    // Simple alert for demo - in real app would be a modal
    alert(`Тренировка на ${day} февраля:\n\nFran\nFor Time: 21-15-9\n- Thrusters (95 lbs)\n- Pull-ups\n\nВаш результат: 8:45\nСтатус: Выполнено ✓`);
}

function showCelebration() {
    // Create celebration effect
    const celebration = document.createElement('div');
    celebration.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 5rem;
        z-index: 1000;
        animation: celebrate 1s ease-out;
        pointer-events: none;
    `;
    celebration.textContent = '🎉';
    document.body.appendChild(celebration);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes celebrate {
            0% {
                transform: translate(-50%, -50%) scale(0);
                opacity: 1;
            }
            50% {
                transform: translate(-50%, -50%) scale(1.5);
            }
            100% {
                transform: translate(-50%, -50%) scale(1) translateY(-100px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        celebration.remove();
        style.remove();
    }, 1000);
}

// Add smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
