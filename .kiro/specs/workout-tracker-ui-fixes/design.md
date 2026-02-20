# Документ дизайна

## Обзор

Этот документ описывает технический дизайн для исправления UI приложения CrossFit Workout Tracker. Приложение представляет собой статическое HTML-приложение с vanilla JavaScript, расположенное в `public/workout-tracker/`. Исправления касаются функциональности календаря выбора дат, согласованности стилей выпадающих списков, адаптивной верстки форм WOD и отображения пагинации.

Основные файлы:
- `index.html` - структура приложения
- `mvp-script-v3.js` - логика приложения
- `mvp-styles.css` - стили приложения

## Архитектура

Приложение использует простую архитектуру:

1. **Презентационный слой** (HTML/CSS)
   - Статическая разметка в `index.html`
   - Стили в `mvp-styles.css` с использованием CSS-переменных для темы
   - Адаптивная верстка через media queries

2. **Логический слой** (JavaScript)
   - Vanilla JavaScript в `mvp-script-v3.js`
   - Управление состоянием через глобальные переменные
   - Event-driven архитектура для взаимодействия с UI

3. **Слой данных**
   - Моковые данные в памяти (массив `workouts`)
   - Состояние календаря в объекте `datePickerState`

## Компоненты и интерфейсы

### 1. Календарь выбора дат

**Текущая реализация:**
- Компонент календаря находится в `#date-picker-modal`
- Состояние хранится в объекте `datePickerState`
- Функции: `toggleDatePicker()`, `selectDate()`, `renderCalendar()`, `focusStartDate()`, `focusEndDate()`

**Изменения:**

#### 1.1 Поведение полей ввода дат (Требование 1)

**Проблема:** Поля ввода дат не выделяют весь текст при клике, разделители можно удалить, порядок ввода не контролируется.

**Решение:**
- Добавить обработчик `onclick` для полей `#start-date-input` и `#end-date-input`, который вызывает `input.select()`
- Использовать маску ввода для формата `ДД.ММ.ГГГГ` с нередактируемыми разделителями
- Реализовать функцию `formatDateInput(input)` для контроля порядка ввода и защиты разделителей

**Псевдокод:**
```
function setupDateInputMask(inputElement):
    inputElement.onclick = () => inputElement.select()
    
    inputElement.oninput = (event) =>
        value = inputElement.value
        digits = extractDigits(value)
        
        if digits.length >= 2:
            formatted = digits.substring(0, 2) + '.'
        if digits.length >= 4:
            formatted += digits.substring(2, 4) + '.'
        if digits.length >= 8:
            formatted += digits.substring(4, 8)
        else if digits.length > 4:
            formatted += digits.substring(4)
            
        inputElement.value = formatted
        
    inputElement.onkeydown = (event) =>
        if event.key == 'Backspace' or event.key == 'Delete':
            cursorPos = inputElement.selectionStart
            if inputElement.value[cursorPos - 1] == '.' or 
               inputElement.value[cursorPos] == '.':
                event.preventDefault()
```

#### 1.2 Гибкость выбора диапазона дат (Требование 2)

**Проблема:** Текущая реализация в `focusEndDate()` показывает alert если дата "От" не выбрана.

**Решение:**
- Удалить проверку `if (!datePickerState.startDate)` из функции `focusEndDate()`
- Модифицировать логику `selectDate()` для автоматической сортировки дат

**Псевдокод:**
```
function selectDate(dateStr):
    date = new Date(dateStr)
    
    if datePickerState.selectedPreset != 'custom':
        selectDatePreset('custom')
    
    if not datePickerState.startDate or 
       (datePickerState.startDate and datePickerState.endDate):
        datePickerState.startDate = date
        datePickerState.endDate = null
    else:
        if date < datePickerState.startDate:
            datePickerState.endDate = datePickerState.startDate
            datePickerState.startDate = date
        else:
            datePickerState.endDate = date
    
    updateDateInputs()
    renderCalendar()
```

#### 1.3 Ограничение доступных месяцев (Требование 3)

**Проблема:** Функция `updateNavButtons()` скрывает кнопку "вперед", но не блокирует навигацию к будущим месяцам полностью.

**Решение:**
- Усилить проверку в `changeMonth(delta)` для предотвращения навигации к будущим месяцам
- Обновить `updateNavButtons()` для корректного отображения состояния кнопок

**Псевдокод:**
```
function changeMonth(delta):
    newDate = new Date(datePickerState.displayedDate)
    newDate.setMonth(newDate.getMonth() + delta)
    
    today = new Date()
    currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    
    lastDisplayedMonth = new Date(newDate)
    lastDisplayedMonth.setMonth(lastDisplayedMonth.getMonth() + 2)
    
    if lastDisplayedMonth > currentMonth:
        return
    
    datePickerState.displayedDate = newDate
    renderCalendar()
```

#### 1.5 Исправление навигации календаря (Требование 9)

**Проблема:** Стрелка назад (к прошедшим месяцам) не работает при клике. По умолчанию календарь показывает текущий и 2 следующих месяца вместо текущего и 2 предыдущих.

**Решение:**
- Проверить и исправить обработчик события для кнопки навигации назад
- Изменить логику `getInitialDisplayMonth()` чтобы по умолчанию показывать текущий месяц как последний (справа), а не первый
- Обновить `changeMonth(delta)` для корректной работы навигации назад

**Псевдокод:**
```
function getInitialDisplayMonth():
    monthsToShow = getMonthsToDisplay()
    
    if datePickerState.endDate:
        lastMonth = new Date(datePickerState.endDate)
        lastMonth.setDate(1)
        
        firstMonth = new Date(lastMonth)
        firstMonth.setMonth(firstMonth.getMonth() - (monthsToShow - 1))
        return firstMonth
    else:
        // По умолчанию: текущий месяц - последний справа
        today = new Date()
        currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        
        firstMonth = new Date(currentMonth)
        firstMonth.setMonth(firstMonth.getMonth() - (monthsToShow - 1))
        return firstMonth

function setupNavigationButtons():
    prevButton = document.querySelector('.calendar-nav-prev')
    nextButton = document.querySelector('.calendar-nav-next')
    
    prevButton.onclick = () => changeMonth(-1)
    nextButton.onclick = () => changeMonth(1)
```


#### 1.4 Адаптивное отображение календаря (Требование 4, 10)

**Проблема:** Календарь всегда показывает 3 месяца независимо от размера экрана. На планшетах и мобильных месяцы слишком сжаты по ширине из-за неправильного значения grid-template-columns.

**Решение:**
- Добавить функцию `getMonthsToDisplay()` которая возвращает количество месяцев на основе ширины viewport
- Модифицировать `renderCalendar()` для использования динамического количества месяцев
- Обновить логику определения начального месяца при наличии выбранных дат
- Исправить CSS для `.calendar-grid-container` на адаптивах

**Псевдокод:**
```
function getMonthsToDisplay():
    width = window.innerWidth
    
    if width < 481:
        return 2  // Изменено: на мобильных показываем 2 месяца
    else if width >= 481 and width <= 768:
        return 2
    else:
        return 3

function getInitialDisplayMonth():
    monthsToShow = getMonthsToDisplay()
    
    if datePickerState.endDate:
        lastMonth = new Date(datePickerState.endDate)
        lastMonth.setDate(1)
        
        firstMonth = new Date(lastMonth)
        firstMonth.setMonth(firstMonth.getMonth() - (monthsToShow - 1))
        return firstMonth
    else:
        today = new Date()
        currentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        
        // Показываем текущий и предыдущие месяцы (не следующие)
        firstMonth = new Date(currentMonth)
        firstMonth.setMonth(firstMonth.getMonth() - (monthsToShow - 1))
        return firstMonth

function renderCalendar():
    container = document.getElementById('calendar-container')
    container.innerHTML = ''
    
    monthsToShow = getMonthsToDisplay()
    displayMonth = getInitialDisplayMonth()
    
    for i from 0 to monthsToShow - 1:
        monthDate = new Date(displayMonth)
        monthDate.setMonth(displayMonth.getMonth() + i)
        container.appendChild(createMonthElement(monthDate))
    
    updateNavButtons()
```

**Изменения в CSS:**
```css
/* Планшеты: 481-768px */
@media (min-width: 481px) and (max-width: 768px) {
    .calendar-grid-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
}

/* Мобильные: < 481px */
@media (max-width: 480px) {
    .calendar-grid-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
        justify-content: center;
    }
}
```

### 2. Унификация стилей выпадающих списков (Требование 5)

**Текущая реализация:**
- Выпадающие списки используют класс `.form-select`
- Стили определены в `mvp-styles.css`
- Разные выпадающие списки могут иметь дополнительные специфичные стили

**Проблема:** Выпадающие списки на разных страницах могут выглядеть по-разному из-за дополнительных стилей или переопределений.

**Решение:**
- Провести аудит всех селекторов `.form-select` в CSS
- Удалить специфичные переопределения стилей для отдельных выпадающих списков
- Убедиться что базовый класс `.form-select` применяется ко всем выпадающим спискам
- Добавить явные стили для состояний `:hover`, `:focus`, `:disabled`

**Изменения в CSS:**
```css
.form-select {
    width: 100%;
    padding: 1rem;
    background: var(--bg-tertiary);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.3s ease;
    appearance: none;
    background-image: url("data:image/svg+xml,...");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 12px;
    padding-right: 2.5rem;
}

.form-select:hover {
    border-color: var(--text-secondary);
}

.form-select:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--bg-secondary);
}

.form-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

**Места применения:**
- История: фильтр по упражнению
- Создать тренировку SKILL: количество подходов
- Создать тренировку WOD: тип тренировки, уровень, количество раундов, результат
- Статистика: выбор упражнения, уровень детализации

### 3. Адаптивная верстка формы WOD

**Текущая реализация:**
- Строка упражнения WOD использует класс `.wod-exercise-row`
- Для desktop: grid layout с колонками
- Для tablet/mobile: flex layout с вертикальным стеком
- Режим лесенки добавляет класс `.ladder-mode`
- Класс `.many-rounds` добавляется когда раундов > 3

#### 3.1 Tablet (481px - 768px) - Требование 6

**Проблема:** На планшетах поля "Повт." и "Вес, кг" должны переноситься на вторую строку и иметь равный размер.

**Текущее состояние:**
```css
@media (max-width: 768px) {
    .wod-exercise-row {
        display: flex;
        flex-direction: column;
    }
    
    .wod-fields-scroll {
        display: flex;
        gap: 0.5rem;
    }
}
```

**Решение:**
- Для диапазона 481-768px создать отдельный media query
- Использовать CSS Grid для размещения полей
- Без лесенки: 2 строки (Упражнение / Повт. + Вес)
- С лесенкой: 3 строки (Упражнение / Раунды / Вес)

**Новые стили:**
```css
@media (min-width: 481px) and (max-width: 768px) {
    .wod-exercise-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.5rem;
        padding: 0.75rem;
        position: relative;
    }
    
    .wod-exercise-name {
        grid-column: 1 / -1;
    }
    
    .wod-exercise-row .btn-icon {
        grid-column: 2;
        grid-row: 1;
        position: static;
    }
    
    .wod-exercise-row:not(.ladder-mode) .wod-fields-scroll {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
    }
    
    .wod-exercise-row.ladder-mode .wod-fields-scroll {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }
    
    .wod-exercise-row.ladder-mode .ladder-reps-container {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
    }
    
    .wod-exercise-row.ladder-mode .wod-weight {
        width: 100%;
    }
}
```

#### 3.2 Mobile (< 481px) - Требование 7, 12, 12

**Проблема:** На мобильных устройствах нужна горизонтальная прокрутка только для полей раундов в режиме лесенки, при этом поля "Упражнение" и "Вес" должны оставаться зафиксированными. Также отступы в режиме лесенки слишком большие.

**Решение:**
- Использовать CSS Grid с фиксированными строками
- Применить `overflow-x: auto` только к контейнеру раундов
- Без лесенки: Повт. и Вес равной ширины под Упражнением
- С лесенкой: Упражнение фиксировано, Раунды прокручиваются, Вес фиксирован
- Исправить grid-template-columns для оптимальных отступов

**Новые стили:**
```css
@media (max-width: 480px) {
    .wod-exercise-row {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
        padding: 0.75rem;
        padding-right: 3rem;
        position: relative;
    }
    
    .wod-exercise-row .btn-icon {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
    }
    
    .wod-exercise-name {
        width: 100%;
    }
    
    .wod-exercise-row:not(.ladder-mode) .wod-fields-scroll {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;
    }
    
    .wod-exercise-row.ladder-mode {
        grid-template-columns: 250px 1fr 100px 40px;
    }
    
    .wod-exercise-row.ladder-mode .wod-fields-scroll {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.5rem;
    }
    
    .wod-exercise-row.ladder-mode .ladder-reps-container {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
    }
    
    .wod-exercise-row.ladder-mode .ladder-reps-container input {
        flex: 0 0 65px;
        width: 65px;
        min-width: 65px;
    }
    
    .wod-exercise-row.ladder-mode .wod-weight {
        width: 100%;
    }
    
    .wod-exercise-row.ladder-mode .single-reps-container {
        display: none;
    }
}
```

### 3.3 Desktop scrollbar styling (Требование 11)

**Проблема:** На десктопе при создании WOD с количеством раундов больше 6 появляется горизонтальная прокрутка, но она не стилизована.

**Решение:**
- Добавить стилизацию scrollbar для `.ladder-reps-container` на десктопе
- Использовать те же стили, что и на адаптивной версии
- Применить стили для webkit-браузеров и Firefox

**Новые стили:**
```css
/* Стилизация scrollbar для контейнера раундов */
.wod-exercise-row.ladder-mode .ladder-reps-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: var(--color-primary) var(--bg-tertiary);
}

.wod-exercise-row.ladder-mode .ladder-reps-container::-webkit-scrollbar {
    height: 8px;
}

.wod-exercise-row.ladder-mode .ladder-reps-container::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: 4px;
}

.wod-exercise-row.ladder-mode .ladder-reps-container::-webkit-scrollbar-thumb {
    background: var(--color-primary);
    border-radius: 4px;
}

.wod-exercise-row.ladder-mode .ladder-reps-container::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary-hover);
}
```

### 4. Пагинация (Требование 8)

**Текущая реализация:**
- Контейнер пагинации: `#pagination-container`
- Функция `renderPagination(totalPages, currentPage)` создает кнопки
- CSS класс `.pagination-container`

**Проблема:** В CSS есть `flex-direction: column` что может вызывать вертикальное отображение.

**Решение:**
- Убедиться что `.pagination-container` использует `flex-direction: row`
- Добавить `flex-wrap: wrap` для переноса на маленьких экранах
- Убедиться что нет конфликтующих стилей

**Изменения в CSS:**
```css
.pagination-container {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 2rem;
}

.pagination-btn {
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    min-width: 40px;
    height: 40px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
```

## Модели данных

### DatePickerState
```javascript
{
    isOpen: boolean,
    currentDate: Date,
    displayedDate: Date,
    startDate: Date | null,
    endDate: Date | null,
    selectedPreset: string
}
```

### WOD Exercise Row State
```javascript
{
    exerciseName: string,
    isLadderMode: boolean,
    ladderRounds: number,
    singleReps: number,
    roundReps: number[],
    weight: number | null,
    isCardio: boolean
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

После анализа acceptance criteria, я выявил следующие группы свойств:

**Группа 1: Поведение полей ввода дат**
- Свойства 1.1-1.4 все касаются поведения полей ввода дат
- Можно объединить в одно комплексное свойство о корректном форматировании и защите ввода

**Группа 2: Гибкость выбора дат**
- Свойства 2.2 и 2.3 связаны - оба проверяют что даты корректно сортируются
- Свойство 2.3 является следствием 2.2, можно объединить

**Группа 3: Адаптивное отображение**
- Свойства 4.1-4.4 все проверяют количество месяцев для разных размеров экрана
- Это примеры одного общего свойства о соответствии количества месяцев размеру viewport

**Группа 4: Согласованность стилей**
- Свойства 5.2-5.5 все проверяют что конкретные элементы имеют одинаковые стили
- Свойство 5.1 уже покрывает все эти случаи как общее правило

**Группа 5: Адаптивная верстка WOD**
- Свойства 6.1-6.4 и 7.1-7.5 все проверяют layout для конкретных размеров экрана
- Это примеры, которые нужно протестировать индивидуально

### Свойства для тестирования

**Property 1: Маска ввода даты**
*For any* последовательность цифр введенная в поле даты, результат должен быть отформатирован как ДД.ММ.ГГГГ с нередактируемыми разделителями "."
**Validates: Requirements 1.2, 1.3, 1.4**

**Property 2: Выделение текста при клике**
*For any* поле ввода даты, при клике весь текст в поле должен быть выделен
**Validates: Requirements 1.1**

**Property 3: Автоматическая сортировка дат**
*For any* две выбранные даты, независимо от порядка выбора, более ранняя дата должна быть назначена в поле "От", а более поздняя в поле "До"
**Validates: Requirements 2.2, 2.3**

**Property 4: Блокировка будущих месяцев**
*For any* попытка навигации к месяцу позже текущего, навигация должна быть предотвращена
**Validates: Requirements 3.2**

**Property 5: Разрешение прошлых месяцев**
*For any* месяц ранее текущего, навигация к этому месяцу должна быть разрешена
**Validates: Requirements 3.3**

**Property 6: Согласованность стилей выпадающих списков**
*For any* два элемента с классом `.form-select`, их computed styles для ключевых свойств (padding, background, border, border-radius, color, font-size) должны быть идентичны
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

**Property 7: Горизонтальная пагинация**
*For any* контейнер пагинации, его flex-direction должен быть 'row', а не 'column'
**Validates: Requirements 8.1, 8.2**

### Примеры для тестирования

Следующие критерии требуют тестирования конкретных примеров, так как они проверяют специфичное поведение для определенных условий:

**Example 1: Выбор даты "До" без даты "От"**
При клике на поле "До" когда поле "От" пусто, не должен показываться alert
**Validates: Requirements 2.1**

**Example 2: Текущий месяц как последний**
Последний отображаемый месяц в календаре должен быть текущим месяцем
**Validates: Requirements 3.1**

**Example 3: Адаптивное отображение - Desktop (>768px)**
При ширине viewport > 768px, календарь должен отображать 3 месяца

**Example 4: Адаптивное отображение - Tablet (481-768px), даты не выбраны**
При ширине viewport 481-768px без выбранных дат, календарь должен отображать 2 месяца: текущий и предыдущий
**Validates: Requirements 4.1**

**Example 5: Адаптивное отображение - Tablet (481-768px), даты выбраны**
При ширине viewport 481-768px с выбранными датами, календарь должен отображать последний выбранный месяц и месяц перед ним
**Validates: Requirements 4.2**

**Example 6: Адаптивное отображение - Mobile (<481px), даты не выбраны**
При ширине viewport < 481px без выбранных дат, календарь должен отображать 1 месяц: текущий
**Validates: Requirements 4.3**

**Example 7: Адаптивное отображение - Mobile (<481px), даты выбраны**
При ширине viewport < 481px с выбранными датами, календарь должен отображать только последний выбранный месяц
**Validates: Requirements 4.4**

**Example 8: Сохранение базовых стилей**
Выпадающий список ввода названия упражнения на странице Создать тренировку SKILL должен сохранить свои стили после изменений
**Validates: Requirements 5.5**

**Example 9: WOD Tablet - без лесенки, вторая строка**
При ширине viewport 481-768px в WOD без лесенки, поля "Повт." и "Вес, кг" должны быть на второй строке
**Validates: Requirements 6.1**

**Example 10: WOD Tablet - без лесенки, равные размеры**
При ширине viewport 481-768px в WOD без лесенки, поля "Повт." и "Вес, кг" должны иметь равную ширину
**Validates: Requirements 6.2**

**Example 11: WOD Tablet - с лесенкой, вес на третьей строке**
При ширине viewport 481-768px в WOD с лесенкой (5+ раундов), поле "Вес, кг" должно быть на третьей строке
**Validates: Requirements 6.3**

**Example 12: WOD Tablet - с лесенкой, раунды на второй строке**
При ширине viewport 481-768px в WOD с лесенкой, поля раундов должны быть на второй строке
**Validates: Requirements 6.4**

**Example 13: WOD Mobile - без лесенки, равные размеры**
При ширине viewport < 481px в WOD без лесенки, поля "Повт." и "Вес, кг" должны иметь равную ширину
**Validates: Requirements 7.1**

**Example 14: WOD Mobile - с лесенкой, упражнение зафиксировано**
При ширине viewport < 481px в WOD с лесенкой, поле "Упражнение" не должно иметь горизонтальную прокрутку
**Validates: Requirements 7.2**

**Example 15: WOD Mobile - с лесенкой, прокрутка раундов**
При ширине viewport < 481px в WOD с лесенкой, контейнер раундов должен иметь overflow-x: auto
**Validates: Requirements 7.3**

**Example 16: WOD Mobile - с лесенкой, вес зафиксирован**
При ширине viewport < 481px в WOD с лесенкой, поле "Вес, кг" не должно иметь горизонтальную прокрутку
**Validates: Requirements 7.4**

**Example 17: WOD Mobile - с лесенкой, изолированная прокрутка**
При ширине viewport < 481px в WOD с лесенкой, при горизонтальной прокрутке должны прокручиваться только поля раундов
**Validates: Requirements 7.5**

## Обработка ошибок

### Валидация ввода дат

**Сценарий:** Пользователь вводит некорректную дату (например, 32.13.2024)

**Обработка:**
- Функция `formatDateInput()` должна ограничивать ввод валидными значениями
- День: 01-31 (с учетом месяца)
- Месяц: 01-12
- Год: 1900-2099 (разумный диапазон)
- При вводе невалидных значений, поле должно оставаться в предыдущем валидном состоянии

**Псевдокод:**
```
function validateDateInput(day, month, year):
    if month < 1 or month > 12:
        return false
    
    if day < 1:
        return false
    
    daysInMonth = getDaysInMonth(month, year)
    if day > daysInMonth:
        return false
    
    if year < 1900 or year > 2099:
        return false
    
    return true
```

### Обработка изменения размера viewport

**Сценарий:** Пользователь изменяет размер окна браузера во время работы с календарем

**Обработка:**
- Добавить event listener на `window.resize`
- При изменении размера, пересчитать количество отображаемых месяцев
- Перерисовать календарь с новым количеством месяцев
- Сохранить текущее состояние выбора дат

**Псевдокод:**
```
window.addEventListener('resize', debounce(() => {
    if datePickerState.isOpen:
        renderCalendar()
}, 250))
```

### Обработка отсутствия JavaScript

**Сценарий:** JavaScript отключен в браузере

**Обработка:**
- Приложение является JavaScript-зависимым и не будет функционировать без JS
- Рекомендуется добавить `<noscript>` тег с сообщением о необходимости включить JavaScript
- Альтернатива: использовать нативные HTML5 date inputs как fallback

## Стратегия тестирования

### Dual Testing Approach

Для обеспечения корректности реализации будут использоваться два типа тестов:

**Unit Tests:**
- Проверка конкретных примеров и edge cases
- Тестирование специфичных условий для разных размеров экрана
- Проверка интеграции между компонентами
- Фокус на Examples 1-17 из секции Correctness Properties

**Property-Based Tests:**
- Проверка универсальных свойств на большом количестве сгенерированных входных данных
- Минимум 100 итераций на каждый property test
- Фокус на Properties 1-7 из секции Correctness Properties
- Каждый тест должен быть помечен комментарием: `// Feature: workout-tracker-ui-fixes, Property N: [property text]`

### Технологии тестирования

**Для JavaScript:**
- **Jest** - основной test runner
- **@testing-library/dom** - для тестирования DOM манипуляций
- **jsdom** - для эмуляции браузерного окружения
- **fast-check** - для property-based testing

**Конфигурация property-based тестов:**
```javascript
import fc from 'fast-check';

// Feature: workout-tracker-ui-fixes, Property 1: Маска ввода даты
test('date input mask formats any digit sequence as DD.MM.YYYY', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 99999999 }),
      (digits) => {
        const input = document.createElement('input');
        setupDateInputMask(input);
        
        input.value = digits.toString();
        input.dispatchEvent(new Event('input'));
        
        // Проверить что результат соответствует формату ДД.ММ.ГГГГ
        const result = input.value;
        return /^\d{0,2}\.?\d{0,2}\.?\d{0,4}$/.test(result);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Тестирование адаптивности

Для тестирования адаптивного поведения на разных размерах экрана:

**Подход:**
1. Использовать `window.innerWidth` mock для симуляции разных размеров экрана
2. Создать helper функцию `setViewportWidth(width)` для установки размера viewport
3. После изменения размера, вызвать `renderCalendar()` или соответствующую функцию
4. Проверить DOM структуру и CSS свойства

**Пример:**
```javascript
function setViewportWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width
  });
  window.dispatchEvent(new Event('resize'));
}

test('calendar shows 2 months on tablet viewport', () => {
  setViewportWidth(600); // 481-768px range
  
  const container = document.getElementById('calendar-container');
  renderCalendar();
  
  const months = container.querySelectorAll('.calendar-month');
  expect(months.length).toBe(2);
});
```

### Тестирование CSS

Для проверки согласованности стилей:

**Подход:**
1. Использовать `window.getComputedStyle()` для получения computed styles
2. Сравнить ключевые свойства между элементами
3. Создать helper функцию для сравнения стилей

**Пример:**
```javascript
function compareStyles(element1, element2, properties) {
  const style1 = window.getComputedStyle(element1);
  const style2 = window.getComputedStyle(element2);
  
  return properties.every(prop => style1[prop] === style2[prop]);
}

test('all form-select elements have consistent styles', () => {
  const selects = document.querySelectorAll('.form-select');
  const baseSelect = selects[0];
  const properties = ['padding', 'background', 'border', 'borderRadius', 'color', 'fontSize'];
  
  selects.forEach(select => {
    expect(compareStyles(baseSelect, select, properties)).toBe(true);
  });
});
```

### Coverage Goals

- **Unit Tests:** 100% покрытие всех 17 примеров
- **Property Tests:** 100% покрытие всех 7 свойств
- **Code Coverage:** Минимум 80% покрытие измененного кода
- **Manual Testing:** Визуальная проверка на реальных устройствах (desktop, tablet, mobile)

