# Design Audit Page Prompt

## Purpose

This prompt describes a new Design Token Kit Figma plugin page for auditing
the quality of the current design system.

Use it together with a screenshot of the existing plugin interface.

## Prompt

```text
Ты - senior product designer. На основе приложенного скриншота разработай
дизайн новой страницы для Figma-плагина Design Token Kit.

Новая страница предназначена для аудита качества дизайн-системы открытого
Figma-файла. Сохрани визуальный язык исходного интерфейса: светлый тёплый
фон, тёмно-синий текст, бирюзовый основной цвет, оранжевый акцент,
округлые панели, аккуратная плотная компоновка и ощущение
профессионального developer tool.

Не копируй интерфейс буквально. Используй скриншот как reference для стиля,
размеров, отступов, типографики и общей композиции.

Размер интерфейса: узкая панель Figma-плагина примерно 720 x 720 px.
Интерфейс должен хорошо работать при вертикальной прокрутке.

Спроектируй состояние страницы после завершения аудита.

Основная структура:

1. Header:
   - название "Design audit";
   - короткое описание: "Find accessibility, token usage, and structure
     issues in the current Figma file";
   - кнопка "Run audit";
   - переключатель области проверки: "Current page" / "Entire file";
   - выбор профиля: "WCAG AA".

2. Summary panel:
   - большой health score, например "82/100";
   - буквенная оценка "B";
   - краткое описание результата;
   - показатели:
     - "3 Errors";
     - "12 Warnings";
     - "148 Nodes checked";
     - "76% Token coverage".

3. Category navigation:
   - Accessibility;
   - Token usage;
   - Structure;
   - Consistency.

   Для каждой категории покажи количество проблем.

4. Findings list:
   Каждая проблема должна содержать:
   - цветной severity-индикатор;
   - категорию;
   - короткий заголовок;
   - понятное описание;
   - рекомендацию по исправлению;
   - указание проблемного узла, например "Button / Primary";
   - кнопку "Select node" или "Show in Figma".

   Примеры findings:
   - "Text contrast is below WCAG AA";
   - "Primitive color is used directly in a component";
   - "Text node has no bound text style";
   - "Component token references another component token".

5. Filters:
   - фильтр по severity: All / Errors / Warnings;
   - фильтр по категории;
   - аккуратное отображение активного фильтра.

Визуальные требования:

* Интерфейс должен быть практичным, а не декоративным.
* Не используй большие иллюстрации, сложные графики и лишние dashboard-
  карточки.
* Findings должны быть главным содержимым страницы.
* Ошибки должны визуально отличаться от предупреждений, но не выглядеть
  агрессивно.
* Score должен быть заметным, но не занимать большую часть экрана.
* Кнопка "Select node" должна быть очевидной и удобной.
* Сохрани хорошую читаемость при большом количестве findings.
* Используй понятную визуальную иерархию и доступный контраст.
* Покажи, как выглядит вертикальный scroll списка проблем.
* Добавь аккуратные состояния hover и focus для интерактивных элементов.

Сделай high-fidelity UI-концепт, максимально близкий к реальному
Figma-плагину. Покажи один основной экран с результатами аудита и несколько
небольших вариантов состояний: loading, empty state и successful audit with
no issues.
```
