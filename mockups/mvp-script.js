// Navigation
function showScreen(screenName) {
    const screens = document.querySelectorAll('.screen');
    const navLinks = document.querySelectorAll('.nav-link');

    screens.forEach(screen => {
        screen.classList.remove('active');
        if (screen.id === `${screenName}-screen`) {
            screen.classList.add('active');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.screen === screenName) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen(link.dataset.screen);
        });
    });

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

    // Autocomplete
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
        'Push-ups',
        'Burpees',
        'Box Jumps',
        'Wall Balls',
        'Kettlebell Swings',
        'Thrusters',
        'Clean and Jerk',
        'Snatch'
    ];

    if (exerciseInput) {
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
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (exerciseInput && !exerciseInput.contains(e.target) && !autocomplete.contains(e.target)) {
            autocomplete.classList.remove('active');
        }
    });

    // Add exercise button
    const addExerciseBtn = document.querySelector('.btn-add');
    if (addExerciseBtn) {
        addExerciseBtn.addEventListener('click', () => {
            const exerciseList = document.querySelector('.exercise-list');
            const newExercise = document.createElement('div');
            newExercise.className = 'exercise-item';
            newExercise.innerHTML = `
                <input type="text" class="form-input-sm" placeholder="Упражнение">
                <input type="number" class="form-input-sm" placeholder="Вес (кг)">
                <input type="number" class="form-input-sm" placeholder="Повт.">
                <button class="btn-icon">❌</button>
            `;
            exerciseList.appendChild(newExercise);

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

    // Save workout buttons
    const saveBtns = document.querySelectorAll('.btn-primary');
    saveBtns.forEach(btn => {
        if (btn.textContent.includes('Сохранить') && !btn.textContent.includes('изменения')) {
            btn.addEventListener('click', () => {
                const originalText = btn.textContent;
                btn.textContent = '✓ Сохранено!';
                btn.style.background = 'linear-gradient(135deg, #30ff88, #ffbd00)';

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    showScreen('home');
                }, 1500);

                showCelebration();
            });
        }
    });

    // Period selector
    const periodBtns = document.querySelectorAll('.period-btn');
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Workout cards click
    const workoutCards = document.querySelectorAll('.workout-card');
    workoutCards.forEach(card => {
        card.addEventListener('click', () => {
            const workoutName = card.querySelector('.workout-name').textContent;
            alert(`Детали тренировки: ${workoutName}\n\n(В реальном приложении откроется модальное окно с полной информацией и возможностью редактирования)`);
        });
    });
});

function showCelebration() {
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
