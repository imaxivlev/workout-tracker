# Документ дизайна: Исправления UI для Workout Tracker (Часть 2)

## Обзор

Этот документ описывает дизайн для исправления трех оставшихся проблем UI в приложении CrossFit Workout Tracker:
1. Вертикальное отображение кнопок пагинации на странице История
2. Несогласованные стили выпадающих списков по всему приложению
3. Неправильная ширина календаря на планшетах и мобильных устройствах

Все три проблемы являются CSS-исправлениями и не требуют изменений в JavaScript логике.

## Архитектура

Приложение использует следующую архитектуру:
- **Frontend**: Статический HTML с vanilla JavaScript
- **Стили**: CSS с медиа-запросами для адаптивности
- **Основной файл стилей**: `app/globals.css`
- **HTML файлы**: `public/workout-tracker/index.html` и `public/workout-tracker/mvp-index.html`

Все исправления будут внесены в файл `app/globals.css` и HTML файлы.

## Компоненты и интерфейсы

### 1. Компонент пагинации

**Текущая реализация:**
```html
<div id="pagination-container" class="pagination-container"
     style="margin-top: 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
    <!-- Кнопки пагинации генерируются JavaScript -->
</div>
```

**Проблема:** Inline стиль `flex-direction: column` переопределяет CSS правило `.pagination-container { flex-direction: row !important; }`, что приводит к вертикальному отображению кнопок.

**Решение:** Удалить inline стиль `flex-direction: column` из HTML, оставив только CSS управление раскладкой.

**CSS стили (уже корректные):**
```css
.pagination-container {
    flex-direction: row !important;
    justify-content: center;
    gap: 0.5rem;
}
```

### 2. Компонент выпадающих списков

**Текущая реализация:**
Эталонный компонент - это выпадающий список автодополнения на странице "Создать тренировку SKILL":

```html
<!-- Эталонный компонент (SKILL - поле ввода с автодополнением) -->
<input type="text" class="form-input exercise-search">
<div class="autocomplete-dropdown">
    <div class="autocomplete-item">Приседания со штангой на спине</div>
    <div class="autocomplete-item">Фронтальные приседания</div>
    <!-- ... -->
</div>
```

Выпадающие списки, требующие исправления:

```html
<!-- Примеры выпадающих списков -->
<select class="form-select">
    <option>1 подход</option>
    <option>2 подхода</option>
    <!-- ... -->
</select>
```

**Проблема:** 
Пользователь хочет, чтобы пункты (`<option>`) внутри нативных `<select>` элементов выглядели как `.autocomplete-item` элементы (div'ы с padding: 0.75rem 1rem, hover эффектом и т.д.).

**Критическое ограничение браузеров:**
К сожалению, **стилизация `<option>` элементов внутри нативных `<select>` крайне ограничена**. Браузеры не позволяют применять большинство CSS свойств к `<option>` элементам по соображениям безопасности и согласованности с ОС. Это известное ограничение веб-платформы.

**Что МОЖНО стилизовать в `<option>`:**
- `color` (цвет текста)
- `background-color` (цвет фона)
- `font-family`, `font-size`, `font-weight` (ограниченно)

**Что НЕЛЬЗЯ стилизовать в `<option>`:**
- `padding` (игнорируется браузерами)
- `margin` (игнорируется)
- `border` (игнорируется)
- `border-radius` (игнорируется)
- `:hover` псевдокласс (не работает в большинстве браузеров)
- `transition` (не работает)

**Возможные решения:**

**Решение 1: Максимальная стилизация в рамках ограничений**
Применить те стили, которые браузеры поддерживают:

```css
.form-select option {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    font-size: 1rem;
    padding: 0.75rem 1rem;  /* Может не работать, но попробуем */
}
```

**Решение 2: Кастомный выпадающий список (рекомендуется)**
Заменить все `<select>` элементы на кастомные компоненты, аналогичные `.autocomplete-dropdown`:

```html
<!-- Вместо <select> -->
<div class="custom-select">
    <div class="custom-select-trigger">1 подход</div>
    <div class="custom-select-dropdown">
        <div class="custom-select-item">1 подход</div>
        <div class="custom-select-item">2 подхода</div>
        <!-- ... -->
    </div>
</div>
```

```css
.custom-select-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s ease;
}

.custom-select-item:hover {
    background: var(--bg-secondary);
}
```

**Рекомендация:**
Учитывая ограничения браузеров, рекомендуется **Решение 2** - создание кастомных выпадающих списков. Это потребует:
1. Создания HTML структуры для кастомных селектов
2. Написания JavaScript для управления открытием/закрытием и выбором
3. Применения стилей `.autocomplete-item` к пунктам кастомных селектов

Если это слишком трудоемко, можно использовать **Решение 1** с пониманием, что полная идентичность со стилями `.autocomplete-item` недостижима в нативных `<select>`.

### 3. Компонент календаря

**Текущая реализация:**
```css
.calendar-grid-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    flex: 1;
}

/* Tablet and below (up to 992px) */
@media (max-width: 992px) {
    .calendar-grid-container {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* Mobile and small tablets (up to 768px) */
@media (max-width: 768px) {
    .calendar-grid-container {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
}
```

**Проблема:** 
Медиа-запросы не соответствуют требованиям:
- **Требование**: 481-768px должно быть 2 колонки
- **Текущее**: `@media (max-width: 768px)` устанавливает 1 колонку для ВСЕХ размеров ≤768px
- **Результат**: Правило из `@media (max-width: 768px)` переопределяет правило из `@media (max-width: 992px)`, поэтому на планшетах (481-768px) отображается 1 колонка вместо 2

**Почему медиа-запросы зачеркиваются:**
Когда viewport = 600px (планшет):
1. Применяется `@media (max-width: 992px)` → `grid-template-columns: repeat(2, 1fr)` ✅
2. Затем применяется `@media (max-width: 768px)` → `grid-template-columns: 1fr` ❌
3. Второе правило переопределяет первое (каскад CSS)
4. В DevTools первое правило зачеркивается

**Решение:** 
Использовать точные диапазоны медиа-запросов с `min-width` и `max-width`:

**CSS стили:**
```css
/* Базовый стиль (desktop >768px) */
.calendar-grid-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    flex: 1;
}

/* Tablet (481px - 768px) - Requirements 3.1, 3.2 */
@media (min-width: 481px) and (max-width: 768px) {
    .calendar-grid-container {
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }
}

/* Mobile (<481px) - Requirements 3.3, 3.4, 3.5 */
@media (max-width: 480px) {
    .calendar-grid-container {
        grid-template-columns: repeat(1, 1fr);
        gap: 1rem;
        justify-items: center;
    }
    
    .calendar-month {
        width: 100%;
        max-width: 100%;
    }
}
```

**Важно:** Нужно удалить или изменить существующие медиа-запросы `@media (max-width: 992px)` и `@media (max-width: 768px)` для `.calendar-grid-container`, чтобы они не конфликтовали с новыми правилами.

## Модели данных

Этот проект не требует изменений в моделях данных, так как все исправления касаются только CSS стилей и HTML атрибутов.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

В этом проекте у нас есть одно универсальное свойство (property) и несколько конкретных примеров (examples) для тестирования:

### Example 1: Pagination container has no conflicting inline styles

*The* pagination container element (`#pagination-container`) on the History page should not contain inline `flex-direction: column` style that would override the CSS horizontal layout.

**Validates: Requirements 1.1**

### Property 2: All dropdown options match reference autocomplete item styles

*For any* `<option>` element within `<select class="form-select">` in the application, its computed CSS styles (background-color, color, font-size) should match the styles of `.autocomplete-item` elements as closely as browser limitations allow.

**Note:** Due to browser limitations, full style parity (padding, hover effects, transitions) is not achievable with native `<option>` elements. This property validates the styles that CAN be applied.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

### Example 3: Tablet calendar uses 2-column grid

*When* the viewport width is set to 600px (within 481-768px range), the computed `grid-template-columns` value of `.calendar-grid-container` should be equivalent to `repeat(2, 1fr)`.

**Validates: Requirements 3.1**

### Example 4: Mobile calendar uses 1-column grid

*When* the viewport width is set to 400px (below 481px), the computed `grid-template-columns` value of `.calendar-grid-container` should be equivalent to `repeat(1, 1fr)` or `1fr`.

**Validates: Requirements 3.3**

### Example 5: Mobile calendar centers content

*When* the viewport width is set to 400px (below 481px), the `.calendar-grid-container` should have centering styles applied (such as `justify-items: center` or equivalent).

**Validates: Requirements 3.5**

## Error Handling

Этот проект касается только CSS стилей и не требует специальной обработки ошибок. Однако следует учитывать:

1. **Браузерная совместимость**: Убедиться, что CSS свойства поддерживаются во всех целевых браузерах
2. **Медиа-запросы**: Проверить, что медиа-запросы не конфликтуют друг с другом
3. **Специфичность CSS**: Убедиться, что новые правила имеют достаточную специфичность для переопределения существующих стилей

## Testing Strategy

### Dual Testing Approach

Этот проект требует как unit тестов, так и property-based тестов для обеспечения полного покрытия:

- **Unit тесты**: Проверяют конкретные примеры и граничные случаи (например, конкретные размеры viewport)
- **Property тесты**: Проверяют универсальные свойства для всех входных данных (например, все выпадающие списки имеют согласованные стили)

### Property-Based Testing

Для этого проекта мы будем использовать **Playwright** или **Puppeteer** для автоматизированного тестирования UI с возможностью:
- Изменения размера viewport
- Проверки computed CSS стилей
- Проверки HTML атрибутов

**Конфигурация тестов:**
- Минимум 100 итераций для каждого property теста
- Каждый тест должен ссылаться на свойство из документа дизайна
- Формат тега: **Feature: workout-tracker-ui-fixes-2, Property {number}: {property_text}**

### Unit Testing

Unit тесты должны фокусироваться на:
- Проверке конкретных размеров viewport (481px, 768px, 480px, 400px)
- Проверке отсутствия inline стилей в HTML
- Проверке конкретных CSS значений для граничных случаев

### Manual Testing Checklist

После внесения изменений необходимо выполнить ручное тестирование:

1. **Пагинация**:
   - Открыть страницу История
   - Убедиться, что кнопки пагинации отображаются горизонтально
   - Проверить на разных размерах экрана

2. **Выпадающие списки**:
   - Открыть каждую страницу (История, Создать SKILL, Создать WOD, Статистика)
   - Визуально сравнить все выпадающие списки с эталонным
   - Убедиться в согласованности padding, borders, font-size

3. **Календарь**:
   - Открыть страницу История
   - Кликнуть на "Выберите период" для открытия календаря
   - Изменить размер окна браузера:
     - Desktop (>768px): 3 месяца
     - Tablet (481-768px): 2 месяца, полная ширина
     - Mobile (<481px): 1 месяц, центрирован
   - Убедиться, что месяцы не сжаты и удобны для использования
