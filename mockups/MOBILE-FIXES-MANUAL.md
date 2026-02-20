# Финальные правки для мобильных адаптивов

## ✅ Что уже исправлено автоматически:

### 1. Нижнее мобильное меню
- ✅ Создано нижнее меню с 4 иконками (Главная, Создать, Статистика, Профиль)
- ✅ Верхняя навигация скрыта на мобильных
- ✅ Добавлен padding для контента чтобы меню не перекрывало контент
- ✅ Добавлена JS функция `setActiveMobileNav()` для управления активным состоянием

### 2. Календарь (date-picker)
- ✅ Модальное окно центрировано на мобильных
- ✅ Добавлен затемнённый backdrop
- ✅ Адаптивные размеры и правильный overflow
- ✅ Показывает 1 месяц на мобильных вместо 3
- ✅ Кнопки "Применить"/"Отмена" на полную ширину

### 3. WOD упражнения - CSS стили
- ✅ Убран grid layout на мобильных
- ✅ Кнопка удаления позиционирована вверху справа
- ✅ Подготовлен CSS для горизонтального скролла полей

## ⚠️ Требует ручного исправления:

### WOD упражнения - HTML структура

Нужно обновить структуру в двух местах файла `mvp-index.html`:

#### 1. Template (около строки 420-437)
Найдите:
```html
<div class="wod-exercise-row">
    <input type="text" class="form-input-sm wod-exercise-name" ...>
    
    <div class="single-reps-container" style="flex: 1; display: flex;">
        <input type="number" class="form-input-sm" placeholder="Повт." style="width: 100%;">
    </div>

    <div class="ladder-reps-container" style="display: none; gap: 0.5rem; flex: 1; overflow-x: auto;">
        <!-- Reps inputs will be injected here -->
    </div>

    <input type="number" class="form-input-sm wod-weight" placeholder="Вес, кг">
    <button class="btn-icon" onclick="removeWodExercise(this)">❌</button>
</div>
```

Замените на:
```html
<div class="wod-exercise-row">
    <button class="btn-icon" onclick="removeWodExercise(this)">❌</button>
    
    <input type="text" class="form-input-sm wod-exercise-name" placeholder="Упражнение"
        onfocus="showWodExerciseDropdown(this)" oninput="filterWodDropdown(this)">
    
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
```

#### 2. JS функция addWodExerciseRow (около строки 411-439 в mvp-script-v3.js)
Найдите функцию `addWodExerciseRow` и замените её innerHTML на:
```javascript
newRow.innerHTML = `
    <button class="btn-icon" onclick="removeWodExercise(this)">❌</button>
    
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
`;
```

## 🎯 Как это работает:

### Нижнее меню
- Автоматически скрывается на десктопе (769px+)
- Показывается на мобильных (<769px)
- Иконки меняют цвет при активной вкладке

### WOD упражнения на мобильных
После ручной правки структуры:
1. Кнопка ❌ будет вверху справа (не мешает полям)
2. Все поля (упражнение, повторения, вес) будут в контейнере `.wod-fields-scroll`
3. На мобильных этот контейнер получит горизонтальный scroll
4. При включенной "лесенке" все поля раундов будут прокручиваться свайпом

### Календарь
- На десктопе: dropdown под кнопкой
- На мобильных: модальное окно по центру с backdrop
- Показывает 1 месяц вместо 3 на узких экранах

## 📱 Тестирование

После ручных правок откройте:
1. Chrome DevTools (F12)
2. Device Toolbar (Ctrl+Shift+M)
3. Установите ширину 375px (iPhone)
4. Проверьте:
   - ✅ Нижнее меню видно
   - ✅ Верхняя навигация скрыта
   - ✅ Блок WOD упражнения:
     - Крестик вверху справа
     - Поля прокручиваются горизонтально
     - Включите "лесенку" - должны появиться поля для раундов со скроллом
   - ✅ История → Период → календарь открывается по центру

## 🔄 Откат (если что-то сломалось)

Резервные копии созданы:
- `mvp-styles.css.backup`
- `mvp-index.html.backup`

Чтобы откатиться:
```powershell
Copy-Item "mvp-styles.css.backup" "mvp-styles.css" -Force
Copy-Item "mvp-index.html.backup" "mvp-index.html" -Force
```

## 📝 Примечания

- Все изменения применяются ТОЛЬКО на мобильных (<769px)
- Десктоп версия остаётся неизменной
- CSS стили используют !important для перезаписи на мобильных где необходимо
