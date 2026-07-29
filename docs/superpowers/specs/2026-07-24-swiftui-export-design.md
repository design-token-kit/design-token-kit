# Экспорт токенов в SwiftUI - дизайн

Дата: 2026-07-24
Связанный issue: design-token-kit/internal#45

## Задача

Добавить в design-token-kit генерацию дизайн-токенов в SwiftUI и обеспечить
авто-проверку компилируемости сгенерированного кода в CI, при условии, что
проект продолжает локально собираться и работать на Linux/Windows/macOS без
Swift toolchain.

## Контекст

Разработка ведётся на Linux. SwiftUI - Apple-only фреймворк, локально на Linux
не рендерится. Корректность значений токенов уже обеспечивается на уровне DTCG,
доменной модели и TypeScript-конвертеров. Открытый вопрос - как убедиться, что
генератор выдаёт валидный, компилируемый SwiftUI-код, не требуя macOS для
повседневной разработки.

Существующие платформы вывода: css, scss, tailwind. Каждая - директория в
`core/src/core/platforms/` с интерфейсом, Dtcg-конвертером и (для цвета)
серализатором. Форматы перечислены в `core/src/core/io/Format.ts`, writer'ы
регистрируются в `cli/src/commands/formats.ts`, публичные типы экспортируются из
`core/src/index.ts`.

Конкуренты с фичей export-ios-swift (по comparison.yaml): Style Dictionary
(UIKit-first, составные типы не поддержаны, ссылки флэттенятся), Dispersa
(SwiftUI, nested enum, составные через свои struct, ссылки флэттенятся),
Asimonim (SwiftUI, nested enum, составные не поддержаны, ссылки флэттенятся).
Ни один не сохраняет ссылки между токенами - это наш дифференциатор.

## Архитектура: два изолированных контура

### Контур A - генерация (TypeScript, работает везде)

Чистая функция "DTCG -> строка Swift". Ноль зависимости от Swift toolchain.
Собирается и тестируется через `npm build` / `npm test` на всех ОС. Корректность
вывода проверяется snapshot-тестами.

### Контур B - проверка компилируемости (Swift, опциональный, самоотключающийся)

Отдельный скрипт + Swift-пакет-фикстура. Скрипт при отсутствии `swift` в PATH
печатает `skipped` и выходит с кодом 0 (не ошибка). Не входит в `npm build` /
`npm test`. Отдельная команда `npm run verify:swift`.

Инвариант: контур A ничего не знает о контуре B. Проверка компилируемости -
внешний потребитель сгенерированной строки, как любой iOS-проект.

## Структура файлов

### Контур A (core, TypeScript)

```
core/src/core/platforms/swiftui/
  TokenSwiftUiConverter.ts        # интерфейс (по образцу TokenScssConverter)
  DtcgTokenSwiftUiConverter.ts    # реализация: DTCG -> строка Swift
  SwiftColorSerializer.ts         # ColorValue -> Color(...) (по образцу ColorCssSerializer)
core/test/core/swiftui/
  DtcgTokenSwiftUiConverter.test.ts
  SwiftColorSerializer.test.ts
```

Правки в существующих файлах:
- `core/src/core/io/Format.ts` - добавить `SWIFT_UI = "swiftui"`.
- `core/src/index.ts` - экспорт конвертера и типов.
- `cli/src/commands/formats.ts` - регистрация в `writers`.

### Контур B (проверка компилируемости)

```
scripts/verify-swift.mjs
core/test/fixtures/swiftui-compile/
  Package.swift                   # выбор таргета shim vs SwiftUI по ОС
  Sources/
    SwiftUIShim/                  # заглушки Color, Font, CGFloat, EdgeInsets...
    GeneratedTokens/              # сгенерированный Tokens.swift (в .gitignore)
```

Правки: `package.json` - добавить `"verify:swift": "node scripts/verify-swift.mjs"`.

## Форма Swift API

Namespaced enum со `static let` (вариант A). `enum` без кейсов - идиоматичное
пространство имён, не инстанцируется. Вложенные enum один-к-одному отражают
дерево токенов (primitive/semantic/component).

```swift
enum DesignTokens {
    enum Color {
        enum Base {
            static let red = SwiftUI.Color(.sRGB, red: 1, green: 0.2, blue: 0.2)
        }
        // ссылка сохранена, не развёрнута в литерал
        static let primary = DesignTokens.Color.Base.red
    }
    enum Spacing {
        static let md: CGFloat = 16
    }
}
```

Обоснование: только эта форма сохраняет два свойства модели - иерархию и ссылки
между токенами - и делает это изоморфно существующим CSS/SCSS-конвертерам.
Extensions на `Color`/`CGFloat` отвергнуты: ломают изоляцию типов (затенение
`Color.primary`), размазывают структуру по разным extension'ам.

## Маппинг DTCG -> SwiftUI

Паритет с CSS/SCSS по набору типов.

### Скалярные типы

| DTCG | SwiftUI | Заметка |
|---|---|---|
| color | `Color(.sRGB, red:green:blue:opacity:)` | компоненты 0-1; display-p3 -> `.displayP3`; lab/lch/oklch -> sRGB |
| dimension | `CGFloat` | в points |
| duration | `TimeInterval` | ms -> секунды |
| fontWeight | `Font.Weight` | 400 -> `.regular`, 700 -> `.bold` и т.д. |
| cubicBezier | `UnitCurve.bezier(...)` | |

### Составные типы

Собственные struct-обёртки. Имена НЕ затеняют нативные типы SwiftUI (урок из
Dispersa, где `ShadowStyle` затеняет `SwiftUI.ShadowStyle`). Struct-обёртка
генерируется один раз и только если соответствующий тип присутствует в токенах.

| DTCG | наш struct | почему не нативный |
|---|---|---|
| typography | `TypographyToken { font; tracking; lineSpacing }` | `Font` не покрывает letter-spacing/line-height |
| shadow | `ShadowToken { color; radius; x; y; spread }` | нельзя затенять `ShadowStyle` |
| border | `BorderToken { color; width; style }` | нет нативного |
| gradient | `Gradient` (нативный) | нативного достаточно |
| strokeStyle | `StrokeStyleToken` | нет нативного |
| transition | `TransitionToken { duration; timingFunction }` | нет нативного |

### Цвет

sRGB по умолчанию; исходный display-p3 сохраняется как `.displayP3`;
нестандартные пространства (lab, lch, oklab, oklch и пр.) сводятся к sRGB.
Компоненты в диапазоне 0-1, `opacity:` добавляется при alpha < 1.

### Ссылки - дифференциатор

Где DTCG-токен ссылается на другой (`{color.base.red}`), генерируется ссылка на
Swift-константу (`DesignTokens.Color.Base.red`), а не литерал. В Swift `static
let` инициализируются лениво, поэтому порядок объявления не создаёт проблемы
forward-reference. Циклические ссылки - забота уровня модели/резолвера, не
Swift-вывода.

## Проверка компилируемости (scripts/verify-swift.mjs)

Последовательность:
1. Проверить наличие `swift` в PATH. Нет -> печать `skipped: swift toolchain
   not found`, exit 0.
2. Сгенерировать токены из образцового DTCG, положить в
   `Sources/GeneratedTokens/Tokens.swift`.
3. Выбрать конфигурацию по ОС: macOS -> настоящий `import SwiftUI`; иначе ->
   таргет `SwiftUIShim`.
4. `swift build`. Падение билда -> провал проверки (exit != 0).

`SwiftUIShim` - минимальный модуль-заглушка с типами, которые использует
генератор (`Color`, `Font`, `CGFloat`, `EdgeInsets`, `Gradient`, `UnitCurve`,
`TimeInterval` и т.п.), с сигнатурами, совпадающими с реальным SwiftUI в объёме
использования генератора.

## Тестирование

### Контур A (работает на всех ОС, входит в npm test)

- `DtcgTokenSwiftUiConverter.test.ts` - snapshot-сверка вывода: скаляры,
  составные struct, сохранённые ссылки, экранирование Swift-ключевых слов
  (`default`, `class`, `case`), пустой ввод, мультитемы.
- `SwiftColorSerializer.test.ts` - sRGB, display-p3, alpha, fallback lab/lch/
  oklch -> sRGB.

### Контур B (опциональный, вне npm test)

- `npm run verify:swift` - локально скипается без Swift, в CI выполняется.

## CI

`.github/workflows/ci.yml`:
- Существующий job (TS build+test на ubuntu) не меняется.
- Новый job `swift-compile` на `ubuntu-latest`: установка Swift toolchain
  (swift.org action), `npm ci && npm run build`, затем `npm run verify:swift`.
  Swift гарантированно присутствует, поэтому реальная проверка, а не скип.
- Позже как эволюция - опциональный `macos-latest` job против настоящего
  SwiftUI. В первую версию не входит (YAGNI).

## Границы первой версии

Входит: все скалярные и составные типы паритетно с CSS/SCSS; namespaced enum;
сохранение ссылок; Linux+shim CI-проверка; кросс-платформенная локальная сборка.

Не входит (осознанно отложено): Asset Catalog (.xcassets); UIKit-таргет;
macOS-CI против настоящего SwiftUI; extensions-форма API.
