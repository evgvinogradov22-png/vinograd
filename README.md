# Бюджет Планнер

Система планирования и учёта личного/бизнес бюджета.

## Возможности

- 📊 **Бюджет** — планирование приходов, расходов, долгов
- 👥 **Сотрудники** — учёт зарплат с двумя выплатами в месяц
- 💳 **Кредиты** — отслеживание долгов и ежемесячных платежей
- 📋 **ДДС** — движение денежных средств (выполненные операции)
- 📅 **Календарь** — визуальный обзор всех платежей
- 📈 **Финансовое состояние** — график баланса на месяц

## Технологии

- React 18 + Vite
- Tailwind CSS
- Recharts (графики)
- Express.js (backend)
- SQLite (база данных)

## Деплой на Railway

### 1. Залей код на GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/budget-planner.git
git push -u origin main
```

### 2. Создай проект в Railway

1. Зайди на [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Выбери репозиторий
4. Дождись деплоя

### 3. Добавь Volume для базы данных (ВАЖНО!)

Чтобы данные не терялись при передеплое:

1. В проекте нажми на сервис
2. **Settings** → **Volumes** → **Add Volume**
3. Mount Path: `/data`
4. Нажми **Add**
5. Railway передеплоит сервис

База данных будет храниться в `/data/budget.db` и сохранится между деплоями.

### 4. Получи URL

После деплоя Railway даст URL типа:
`https://budget-planner-production.up.railway.app`

## Локальная разработка

```bash
# Установка
npm install

# Запуск frontend (dev server)
npm run dev

# Запуск backend (в отдельном терминале)
node server.js
```

## Пароль

Пароль для входа: **1122**

Изменить: файл `src/App.jsx`, константа `PASSWORD`

## Структура базы данных

SQLite с одной таблицей `data`:
- `key` — ключ (TEXT, PRIMARY KEY)
- `value` — JSON данные (TEXT)
- `updated_at` — время обновления

## Лицензия

MIT
