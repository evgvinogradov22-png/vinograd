# 🍇 Виноград — Production System

## Деплой на Railway

### Шаг 1 — Добавь папку в репозиторий

```bash
git add vinogradov/
git commit -m "add vinogradov project"
git push
```

### Шаг 2 — Создай новый сервис на Railway

1. Открой [railway.app](https://railway.app) → твой проект
2. **+ New Service** → **GitHub Repo**
3. Выбери репозиторий, **Root Directory** = `vinogradov`
4. Railway сам найдёт `railway.toml` и всё настроит

### Шаг 3 — Добавь PostgreSQL

1. В том же проекте Railway: **+ New Service** → **Database** → **PostgreSQL**
2. Railway автоматически добавит `DATABASE_URL` в переменные

### Шаг 4 — Добавь переменные окружения

В настройках сервиса **vinogradov** → вкладка **Variables**:

```
INVITE_PASSWORD     = твой_код_для_регистрации   (например: vinograd2026)
R2_ACCOUNT_ID       = 7ff81882f4e5d895f03bb7d791513075
R2_ACCESS_KEY_ID    = deab66b8abc27bcfef91b38dc1a2f3ec
R2_SECRET_ACCESS_KEY= 8d05f7e693e8047c1ce72ba1c8fc5bdd6fcb157f0c0214a8606b87cf311a7b71
R2_BUCKET           = contentflow-files
R2_PUBLIC_URL       = https://pub-3dd93ace78394e159c4cd843d4a6e876.r2.dev
```

### Шаг 5 — Deploy

Railway задеплоит автоматически после push. Первый деплой ~3-5 минут.

---

## Первый вход

1. Открой URL который даст Railway (типа `vinogradov.up.railway.app`)
2. Нажми **Регистрация**
3. Введи код приглашения который ты поставил в `INVITE_PASSWORD`
4. Готово!

---

## Структура

```
vinogradov/
├── server/          — Node.js + Express + WebSocket
│   ├── index.js     — весь сервер (API + WS + R2)
│   └── package.json
├── client/          — React приложение
│   ├── src/
│   │   ├── App.js   — главный интерфейс (все вкладки)
│   │   ├── api.js   — все запросы к серверу
│   │   └── index.js
│   └── package.json
├── railway.toml     — конфиг Railway
├── Procfile         — команда запуска
└── package.json     — build скрипт
```
