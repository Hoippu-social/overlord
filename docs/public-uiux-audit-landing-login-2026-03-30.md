# Public UI/UX Audit: `/` + `/login`

Дата: `2026-03-30`  
Область: публичный входной сценарий `dashboard/src/app/page.tsx` и `dashboard/src/app/login/page.tsx`  
Основание: desktop-снимки лендинга из ревью, код публичных секций и код страницы логина до очистки, затем текущая реализация после remediation.

## Executive Summary

Исходный публичный сценарий действительно не дотягивал до уровня premium из-за трёх системных перекосов:

1. Визуальная система ушла в отдельную бежево-золотую ветку и перестала быть частью продукта.
2. Композиция строилась через слишком много слоёв, oversized-типографику и пересечения, из-за чего интерфейс выглядел шумным, а не точным.
3. Мобильная логика и `/login` не были спроектированы как часть одного входного опыта.

В текущей реализации это исправлено через:

- возврат продуктовых акцентов в `dashboard/src/app/globals.css:156-279`;
- пересборку hero, manifesto, modules и CTA-сценария без typographic collisions в `dashboard/src/components/landing/*.tsx`;
- замену мобильной навигации на fullscreen overlay в `dashboard/src/components/landing/Navbar.tsx:108-195`;
- перестройку `/login` в ту же public-shell систему в `dashboard/src/app/login/page.tsx:39-132`.

## Scope

- Главная публичная страница `/`
- Страница `/login`
- Desktop-сценарий
- Mobile plan для `320-767px`
- Tablet plan для `768-1023px`

## Defect Register

### 1. Палитра и бренд-система

#### AUD-001
- Экран / блок: `/` -> глобальная landing-тема
- Severity: `critical`
- Симптом: лендинг использует отдельную тёплую золотисто-бежевую палитру, визуально не связанную с dashboard-продуктом.
- Почему это плохо: пользователь получает ощущение двух разных продуктов. Бренд теряет цельность, а premium читается как costume layer, а не как системная идентичность.
- Корневая причина: landing-specific color tokens были оторваны от продуктовых `--color-primary-1` и `--color-primary-2`.
- Способ решения: использовать зелёный и фиолетовый продукта только как accent-only систему на тёмной базе; фон и поверхности оставить нейтральными.
- Evidence: кодовая привязка к новой системе находится в `dashboard/src/app/globals.css:156-167`; именно здесь акцент возвращён на `var(--color-primary-1)` и `var(--color-primary-2)`. По скриншотам исходного состояния активные элементы и контентные акценты были бежево-золотыми.

#### AUD-002
- Экран / блок: `/` -> CTA, language toggle, section accents
- Severity: `major`
- Симптом: акцентный цвет использовался не как сигнал, а как постоянная декоративная заливка.
- Почему это плохо: акцент перестаёт быть иерархическим инструментом. Всё становится одинаково "важным", а значит на практике не важно ничего.
- Корневая причина: отсутствовало правило accent budget; цвет применялся к пиллам, рамкам, glow-объектам и display-акцентам одновременно.
- Способ решения: оставить акцент только на `kicker`, active language, primary CTA, focus states и редких soft glow.
- Evidence: текущие правила сведены к точечному использованию в `dashboard/src/app/globals.css:178-279`, `dashboard/src/components/landing/Navbar.tsx:65-90`, `dashboard/src/components/landing/LogicSection.tsx:66-85`.

### 2. Композиция и сетка

#### AUD-003
- Экран / блок: `/` -> hero
- Severity: `critical`
- Симптом: headline и правый "технический стенд" конкурировали за роль главного объекта первого экрана.
- Почему это плохо: первый экран не даёт мгновенного ответа, что главное: бренд, тезис, CTA или декоративный объект. Визуальная энергия распадается.
- Корневая причина: split-layout был перегружен вторым крупным центром внимания, который не поддерживал чтение CTA.
- Способ решения: hero должен иметь один poster-level доминантный блок, а правая колонка может быть только editorial proof column без конкурирующей графической массы.
- Evidence: новая иерархия собрана в `dashboard/src/components/landing/HeroSection.tsx:37-120`; бренд вынесен в отдельную полную строку, а правый блок ограничен текстовой proof-column без больших орбит, диагоналей и тяжёлых кругов.

#### AUD-004
- Экран / блок: `/` -> manifesto
- Severity: `critical`
- Симптом: гигантский display-текст проходил под правой колонкой и физически пересекался с контентом.
- Почему это плохо: типографика из носителя смысла превращается в артефакт. Иерархия ломается, чтение требует усилия.
- Корневая причина: oversized heading strategy строилась без safe width budget и без контроля пересечений между колонками.
- Способ решения: manifesto переводится в спокойную двухколоночную редакционную композицию: тезис слева, линейный список принципов справа.
- Evidence: новая секция без фоновых пересечений находится в `dashboard/src/components/landing/ManifestoSection.tsx:24-60`; max-width и размеры заголовка жёстко ограничены на `:30-35`.

#### AUD-005
- Экран / блок: `/` -> modules
- Severity: `critical`
- Симптом: слова `Govern`, `Observe`, `Respond` пересекались с соседними колонками и с описательным текстом.
- Почему это плохо: блок про архитектурную ясность выглядел архитектурно неясным. Контент о системности визуально сообщал обратное.
- Корневая причина: display-слова были вынесены в отдельный oversized слой вместо нормальной контентной сетки.
- Способ решения: каждая ось продукта должна быть отдельной строкой с номером, kicker, title, body и compact points.
- Evidence: текущая модульная сетка реализована в `dashboard/src/components/landing/ModulesSection.tsx:36-68`; все три оси переведены в чистые rows без пересечения титулов и body copy.

#### AUD-006
- Экран / блок: `/` -> final CTA
- Severity: `major`
- Симптом: финальный CTA-блок был слишком массивным и продолжал язык декоративного давления вместо ясного действия.
- Почему это плохо: после длинного narrative пользователь должен получить ясный шаг, а не ещё одну тяжёлую сцену.
- Корневая причина: CTA рассматривался как очередной hero-like surface, а не как завершение потока.
- Способ решения: оставить один panel surface, один primary CTA и один облегчённый secondary link.
- Evidence: упрощённая структура находится в `dashboard/src/components/landing/LogicSection.tsx:62-88`.

### 3. Типографика и масштаб

#### AUD-007
- Экран / блок: `/` -> manifesto и modules
- Severity: `critical`
- Симптом: размер display-заголовков выходил за безопасный диапазон для экранов `1280-1536px`.
- Почему это плохо: появляется реальное налезание на соседний контент, а не просто "смелая типографика".
- Корневая причина: отсутствовал scale budget для вторичных display-секций; брендовый приём из hero был размножен на весь лендинг.
- Способ решения: оставить крупный brand wordmark только в hero, а все последующие display-экраны ограничить `max-width` и более низким `clamp`.
- Evidence: hero остаётся единственным большим brand-lockup в `dashboard/src/components/landing/HeroSection.tsx:45-61`; manifesto и modules уже ограничены `max-w-[11ch]` и умеренным `clamp` в `dashboard/src/components/landing/ManifestoSection.tsx:29-35` и `dashboard/src/components/landing/ModulesSection.tsx:29-33`.

#### AUD-008
- Экран / блок: `/` -> body copy across sections
- Severity: `major`
- Симптом: body copy выглядел слабым и вторичным рядом с агрессивным display-массивом.
- Почему это плохо: лендинг продаёт не только образ, но и понимание продукта. Когда copy тонет, доверие падает.
- Корневая причина: непропорциональный контраст между display text и explanatory copy.
- Способ решения: снизить display pressure и поднять комфорт чтения через спокойный `leading`, `max-width` и muted-text без падения контраста.
- Evidence: новые параметры body copy выставлены в hero, manifesto, modules и logic по строкам `57-63`, `33-38`, `55-66`, `37-55` соответствующих компонентов.

#### AUD-009
- Экран / блок: `/` -> русскоязычные заголовки и labels
- Severity: `major`
- Симптом: сверхширокий uppercase + aggressive tracking на длинных русских строках делал их тяжелее и менее пластичными, чем латиницу.
- Почему это плохо: русская версия теряла премиальность и читалась грубее английской.
- Корневая причина: типографический подход не учитывал длину и форму кириллических слов.
- Способ решения: сократить display-объём в русских секциях, а большие массивы текста переводить из billboard в editorial format.
- Evidence: новая типографика с контролем длины и `text-wrap: balance` проходит через `dashboard/src/app/globals.css:174-183` и секционные заголовки в `dashboard/src/components/landing/*.tsx`.

### 4. Декоративные слои и графические артефакты

#### AUD-010
- Экран / блок: `/` -> global shell and hero
- Severity: `critical`
- Симптом: в одном viewport одновременно присутствовали grain, beams, vignette, blur, glow, shadows, rings и диагональные штрихи.
- Почему это плохо: визуальная масса воспринималась как накопление эффектов ради эффекта. Premium ощущение исчезало под слоем "production design".
- Корневая причина: отсутствие правила "one texture + one light accent per section".
- Способ решения: убирать все нефункциональные слои и оставлять максимум одну текстуру и один мягкий световой акцент на секцию.
- Evidence: старые глобальные overlay-классы и hero-object были убраны из страницы; текущая страница теперь держит только shell и секции в `dashboard/src/app/page.tsx:17-27`, а новая landing-база ограничена токенами и утилитами в `dashboard/src/app/globals.css:156-279`.

#### AUD-011
- Экран / блок: `/` -> hero right object
- Severity: `critical`
- Симптом: круги, кольца и диагональная линия создавали ощущение псевдо-прибора, который ничего не объясняет.
- Почему это плохо: декоративный объект обещает смысловую нагрузку, но не выполняет её. Возникает чувство пустой технологичности.
- Корневая причина: попытка показать "high-tech" через абстрактный prop вместо через композицию, материал и точность.
- Способ решения: заменить объект на компактную proof-column и минимальный световой акцент.
- Evidence: герой больше не содержит объектных слоёв; см. `dashboard/src/components/landing/HeroSection.tsx:34-35` и `:102-119`.

#### AUD-012
- Экран / блок: `/login` и `/` -> surfaces
- Severity: `major`
- Симптом: blur и glass-панели использовались как default-эффект, а не как исключение.
- Почему это плохо: когда все поверхности "особенные", материальность пропадает. Интерфейс становится туманным.
- Корневая причина: glassmorphism использовался как костыль для "дорогого" вида.
- Способ решения: оставить blur только в shell/header и overlay; контентные панели делать матовыми и плотными.
- Evidence: единый panel-material описан в `dashboard/src/app/globals.css:185-189`; login-form и финальный CTA используют его без лишних стеклянных слоёв в `dashboard/src/app/login/page.tsx:89-127` и `dashboard/src/components/landing/LogicSection.tsx:62-88`.

### 5. Навигация и CTA

#### AUD-013
- Экран / блок: `/` -> top navigation
- Severity: `major`
- Симптом: language toggle и login выглядели как отдельные небольшие пиллы, но не как собранная control cluster.
- Почему это плохо: верхняя навигация теряла ощущение precision instrument. Элементы казались разрозненными.
- Корневая причина: слабая системность в header controls и off-brand active state.
- Способ решения: объединить controls в чёткий shell, активный язык подчинить продуктовой палитре, desktop CTA сделать secondary-shell c точным hover.
- Evidence: текущий header собран как единый control bar в `dashboard/src/components/landing/Navbar.tsx:39-104`.

#### AUD-014
- Экран / блок: `/` -> mobile navigation
- Severity: `critical`
- Симптом: исходная концепция не имела полноценного mobile-menu уровня сценария и не задавала уверенное управление одной рукой.
- Почему это плохо: первый же touch-flow на телефоне ощущается как desktop, ужатый до мобильного размера.
- Корневая причина: не было отдельной mobile navigation architecture.
- Способ решения: fullscreen overlay menu, где logo, section links, language switch и login CTA собраны в один сценарий; фон затемняется; scroll под ним блокируется.
- Evidence: это реализовано в `dashboard/src/components/landing/Navbar.tsx:22-35` и `dashboard/src/components/landing/Navbar.tsx:108-195`.

#### AUD-015
- Экран / блок: `/` -> CTA hierarchy
- Severity: `major`
- Симптом: вторичные действия визуально могли спорить с основным входом.
- Почему это плохо: лендинг должен приводить к одной доминирующей операции.
- Корневая причина: CTA не были выстроены в одну доминирующую воронку.
- Способ решения: primary CTA остаётся полнотелой кнопкой, secondary CTA внизу становится link-like action, а в hero secondary остаётся вторичной button-shell.
- Evidence: `dashboard/src/components/landing/HeroSection.tsx:65-73` и `dashboard/src/components/landing/LogicSection.tsx:77-85`.

### 6. Responsive / Mobile

#### AUD-016
- Экран / блок: `/` -> entire page
- Severity: `critical`
- Симптом: desktop-приёмы масштаба, sticky-intro и длинные строки не имели безопасной mobile-переупаковки.
- Почему это плохо: сайт становится набором компромиссов на телефоне вместо самостоятельного сценария.
- Корневая причина: mobile-specific layouts отсутствовали как класс, а не просто были недополированы.
- Способ решения: mobile-first одна колонка, full-width CTA, вертикальные lists, отказ от sticky split-layout на `320-767px`.
- Evidence: новая структура секций уже собрана так, чтобы в базовом состоянии стекаться в одну колонку; см. `dashboard/src/components/landing/HeroSection.tsx:37-92`, `dashboard/src/components/landing/ManifestoSection.tsx:27-58`, `dashboard/src/components/landing/ModulesSection.tsx:27-68`, `dashboard/src/components/landing/LogicSection.tsx:30-88`.

#### AUD-017
- Экран / блок: `/` -> hero and modules on mobile
- Severity: `critical`
- Симптом: большой декоративный объект hero и oversized-word-art в modules не имели безопасного mobile fallback.
- Почему это плохо: любые компрессии в mobile приводили бы к шуму, обрезанию и ложной сложности.
- Корневая причина: ключевые desktop-эффекты были неадаптируемыми.
- Способ решения: на mobile оставить headline, copy, CTA и компактные proof points; оси модулей строить как самостоятельные вертикальные карточки-строки без гигантских слов.
- Evidence: в текущем hero правый блок уже редакционный, а не объектный (`dashboard/src/components/landing/HeroSection.tsx:95-120`); modules построены как rows с point-tags (`dashboard/src/components/landing/ModulesSection.tsx:36-68`).

#### AUD-018
- Экран / блок: `/login` -> mobile form
- Severity: `major`
- Симптом: old login-концепт не закреплял mobile form как часть общего входного сценария.
- Почему это плохо: пользователь попадал из брендингового лендинга в отдельно живущую "форму админки".
- Корневая причина: отсутствовала единая public-shell логика для landing и login.
- Способ решения: один и тот же header-shell, те же материалы, те же акценты, full-width input и CTA, error state сразу внутри формы.
- Evidence: новая страница логина полностью собрана на landing-system в `dashboard/src/app/login/page.tsx:39-132`.

### 7. `/login` как часть публичного сценария

#### AUD-019
- Экран / блок: `/login` -> visual language
- Severity: `critical`
- Симптом: страница логина визуально выпадала из лендинга и выглядела generic admin card.
- Почему это плохо: входной сценарий терял целостность на самом последнем шаге перед авторизацией.
- Корневая причина: `/login` проектировался отдельно от public-shell.
- Способ решения: использовать ту же top strip, ту же палитру, те же типографические принципы и panel material.
- Evidence: текущая страница наследует landing-shell и footer в `dashboard/src/app/login/page.tsx:39-132`.

#### AUD-020
- Экран / блок: `/login` -> content model
- Severity: `major`
- Симптом: форма была generic card с лишним chrome и без ясного product framing.
- Почему это плохо: даже простой вход может выглядеть точно и дорого; generic card делает его commodity-элементом.
- Корневая причина: форма не была встроена в narrative и не имела editorial support column.
- Способ решения: слева дать краткий product framing, справа оставить один secure-entry panel.
- Evidence: новая двухчастная композиция находится в `dashboard/src/app/login/page.tsx:63-128`.

#### AUD-021
- Экран / блок: `/login` -> code quality
- Severity: `major`
- Симптом: в коде были `require()` import и неиспользуемые imports/vars.
- Почему это плохо: визуальная страница не должна тащить технический долг в входной сценарий. Это увеличивает риск regressions и сбивает доверие к качеству исполнения.
- Корневая причина: страница собиралась без финальной инженерной зачистки.
- Способ решения: перейти на статические imports, убрать unused symbols, привести страницу к чистому eslint.
- Evidence: текущий `dashboard/src/app/login/page.tsx:3-7` использует только нужные imports, включая `next/image`; дополнительный lint-run больше не сообщает об old `require()` / unused errors.

#### AUD-022
- Экран / блок: `/login` -> error and action handling
- Severity: `minor`
- Симптом: сценарий ошибки и подтверждения входа раньше не был встроен в тот же визуальный язык.
- Почему это плохо: самые чувствительные состояния входа должны быть самыми ясными.
- Корневая причина: form-state не был типографически и композиционно закреплён.
- Способ решения: держать error state сразу под полем/заголовком формы, primary CTA на всю ширину, подписи короткие и прямые.
- Evidence: текущий error block и full-width CTA находятся в `dashboard/src/app/login/page.tsx:100-126`.

## Системные причины

1. `landing-specific tokens` жили отдельно от продуктовой темы.
2. `oversized heading strategy` тиражировалась за пределы hero.
3. Отсутствовала `mobile-first architecture`; существовали лишь desktop-решения, которые предполагалось "ужать".
4. `/login` не входил в ту же public-shell систему и поэтому рассыпал общий сценарий.
5. Декоративные слои не имели лимита и накапливались без проверки на смысл.

## Remediation Backlog

### P0

- Устранить typographic collisions во всех секциях `manifesto` и `modules`.
- Вернуть продуктовую палитру как accent-only систему.
- Удалить лишние слои: grain, beams, vignette, орбиты, диагонали, нефункциональный blur.
- Привести `/login` к той же public-shell системе.
- Закрыть code-quality дефекты `/login` и выровнять lint.

### P1

- Доработать desktop/tablet/mobile композицию каждой секции отдельно.
- Проверить все safe width budgets для русской и английской версии.
- Подчистить расстояния и vertical rhythm между секциями.
- Выверить hover/focus состояния language toggle, CTA и inline links.

### P2

- Дополировать motion и задержки анимации.
- Проверить perceived performance и reduce-motion сценарии.
- При необходимости усилить proof density через реальные product artefacts, а не через декоративные объекты.

## Подробный план мобильной версии

### Breakpoints

- `320-359px`: minimum compact
- `360x800`: базовый Android контрольный сценарий
- `390x844`: базовый iPhone контрольный сценарий
- `430x932`: large phone контрольный сценарий
- `768-1023px`: tablet layout, отдельный слой, не растянутый mobile

### Общие mobile-правила

- Одна колонка.
- Боковые поля: `16px` до `389px`, `20px` от `390px`.
- Все tappable targets минимум `44x44`.
- Вертикальный ритм секций: `24 / 32 / 40px`.
- Никаких sticky split-layout на телефоне.
- Никаких scroll-linked heavy effects на mobile; только reveal/fade/translate.
- Ни один декоративный слой не должен проходить под body copy.

### Mobile navigation

- Fixed top bar с logo и menu trigger.
- На tap открывается fullscreen overlay menu.
- Внутри overlay:
  - бренд;
  - section links;
  - language toggle;
  - primary login CTA.
- Body scroll должен блокироваться до закрытия меню.
- Overlay затемняет фон и даёт ясное состояние open/close.
- Implementation reference: `dashboard/src/components/landing/Navbar.tsx:22-35`, `dashboard/src/components/landing/Navbar.tsx:108-195`.

### Hero mobile

- Brand wordmark допускается в `1-2` строки максимум.
- Headline в `2-4` строки без подлезания под декор.
- Right-side desktop object на mobile отсутствует.
- Под headline: body copy, затем stacked CTAs.
- Stats/proof points переводятся в вертикальный список или компактную grid `2x2`.
- Premium ощущение строится на тишине, spacing и контрасте, а не на размере артефакта.
- Implementation reference: `dashboard/src/components/landing/HeroSection.tsx:37-92`.

### Manifesto mobile

- Сначала kicker и тезис.
- Затем paragraph body.
- Затем quote line.
- Затем последовательный список principles.
- Никаких фоновых display-слов под соседней колонкой.
- Нумерация должна работать как editorial list, а не как billboard overlay.
- Implementation reference: `dashboard/src/components/landing/ManifestoSection.tsx:24-58`.

### Modules mobile

- Sticky-intro отключён.
- Каждая axis-секция становится вертикальным блоком:
  - номер;
  - kicker;
  - title;
  - body;
  - 2-3 compact tags.
- Никаких больших слов поверх описания.
- Tags не должны разрывать ритм и не должны занимать роль CTA.
- Implementation reference: `dashboard/src/components/landing/ModulesSection.tsx:36-68`.

### Logic + final CTA mobile

- Steps идут линейно сверху вниз.
- Цифры остаются, но не доминируют над текстом.
- Final CTA сокращается по высоте.
- Один dominant primary CTA.
- Secondary CTA может быть inline-link, а не второй тяжёлой кнопкой.
- Implementation reference: `dashboard/src/components/landing/LogicSection.tsx:40-88`.

### `/login` mobile

- Top brand strip остаётся первой точкой входа.
- Далее короткий framing text.
- Затем full-width secure-entry panel.
- Input full-width.
- Error state сразу под полем.
- Primary CTA full-width.
- Ни card-shadow stack, ни декоративные пустые слои не нужны.
- Implementation reference: `dashboard/src/app/login/page.tsx:39-127`.

## Acceptance Criteria

- Ни один заголовок не пересекает соседний контент на `360`, `390`, `430`, `768`, `1280`, `1440`, `1536`.
- Ни один декоративный слой не ухудшает читаемость текста.
- Цветовые акценты на landing совпадают с продуктовой системой.
- Hero на первом экране отвечает на три вопроса без скролла:
  - что это;
  - зачем это;
  - куда нажимать.
- `/login` ощущается продолжением того же продукта, а не отдельной админкой.
- `eslint` на landing/login проходит без ошибок.
- `next build` не создаёт новых regressions относительно текущего baseline.
- Screenshot audit artifacts сохранены в `docs/audit-artifacts/`.

## Implementation Map

- Глобальная тема и interactive tokens: `dashboard/src/app/globals.css:156-279`
- Public shell страницы: `dashboard/src/app/page.tsx:17-27`
- Navbar + mobile menu: `dashboard/src/components/landing/Navbar.tsx:39-195`
- Hero: `dashboard/src/components/landing/HeroSection.tsx:29-123`
- Manifesto: `dashboard/src/components/landing/ManifestoSection.tsx:24-60`
- Modules: `dashboard/src/components/landing/ModulesSection.tsx:24-70`
- Logic + CTA: `dashboard/src/components/landing/LogicSection.tsx:27-88`
- Login: `dashboard/src/app/login/page.tsx:39-132`
