# 🚀 Консольные команды для развертывания ProjectKanban Telegram Bot

## ⚡ Быстрый старт (Docker)

### 1️⃣ Первый запуск — сборка и запуск
```bash
cd /path/to/ProjectKanban
docker compose up -d --build
```

### 2️⃣ Просмотр логов
```bash
# Все логи в реальном времени
docker compose logs -f

# Только логи бота
docker logs telegram-bot-xray -f

# Последние 50 строк
docker logs telegram-bot-xray --tail 50
```

### 3️⃣ Остановка контейнера
```bash
docker compose down
```

### 4️⃣ Перезапуск
```bash
docker compose restart
```

### 5️⃣ Пересборка образа (если изменился код)
```bash
docker compose down
docker compose up -d --build
```

---

## 📍 Локальное подключение

**API доступен на:** `http://localhost:8001`

**Endpoints:**
- `GET http://localhost:8001/api/health` — проверка здоровья
- `POST http://localhost:8001/api/notify/project` — уведомление о проекте
- `POST http://localhost:8001/api/notify/group` — уведомление о группе
- `POST http://localhost:8001/api/notify/task` — уведомление о задаче

**Пример проверки:**
```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:8001/api/health"

# Linux/Mac
curl http://localhost:8001/api/health
```

---

## 🔧 Локальная разработка (без Docker)

### 1️⃣ Установка зависимостей
```bash
cd telegram_bot
pip install -r requirements.txt
```

### 2️⃣ Запуск FastAPI (терминал 1)
```bash
cd telegram_bot
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

### 3️⃣ Запуск Telegram бота (терминал 2)
```bash
cd telegram_bot
python main.py
```

### Или оба одной командой (терминал 1):
```bash
cd telegram_bot
python launcher.py
```

---

## 🐳 Полезные Docker команды

### Проверка статуса контейнера
```bash
docker ps
docker ps -a  # Все контейнеры, включая остановленные
```

### Проверка процессов внутри контейнера
```bash
docker exec telegram-bot-xray ps aux
```

### Интерактивная оболочка контейнера
```bash
docker exec -it telegram-bot-xray sh
```

### Очистка (удалить контейнер и образ)
```bash
docker compose down --rmi all
```

### Просмотр использования ресурсов
```bash
docker stats telegram-bot-xray
```

---

## 📊 Мониторинг

### Статус контейнера
```bash
docker inspect telegram-bot-xray
```

### Просмотр портов
```bash
docker port telegram-bot-xray
# Результат: 8000/tcp -> 0.0.0.0:8001
#           10808/tcp -> 0.0.0.0:10808
```

### Проверка логов ошибок
```bash
docker logs telegram-bot-xray --tail 100 | grep -i error
```

---

## 🚨 Если что-то сломалось

### Контейнер не запускается
```bash
# 1. Проверить логи
docker compose logs

# 2. Пересобрать образ
docker compose down
docker compose up -d --build

# 3. Полная очистка
docker compose down --rmi all
docker compose up -d --build
```

### Порт уже занят
```bash
# Проверить кто занял порт 8001
netstat -ano | findstr :8001  # Windows
lsof -i :8001                  # Linux/Mac

# Или изменить в docker-compose.yml:
# ports:
#   - "8002:8000"  # вместо 8001
```

### API не отвечает
```bash
# Проверить, запущен ли контейнер
docker ps

# Проверить логи API
docker compose logs | grep -i fastapi

# Перезапустить
docker compose restart
```

---

## 📦 Структура проекта

```
ProjectKanban/
├── Dockerfile              # Конфиг Docker образа
├── docker-compose.yml      # Конфиг для запуска контейнера
├── entrypoint.sh          # Скрипт запуска
├── telegram_bot/
│   ├── main.py            # Telegram бот
│   ├── api.py             # FastAPI приложение
│   ├── launcher.py        # Launcher для локальной разработки
│   ├── requirements.txt    # Python зависимости
│   ├── config.py          # Конфиг
│   ├── database.py        # Работа с БД
│   ├── handlers.py        # Обработчики команд
│   └── ...
```

---

## ✅ Проверка после запуска

```bash
# 1. Контейнер запущен?
docker ps | grep telegram-bot-xray

# 2. Логи без ошибок?
docker logs telegram-bot-xray

# 3. API отвечает?
curl http://localhost:8001/api/health

# 4. Процессы запущены?
docker exec telegram-bot-xray ps aux
# Должны быть: python main.py и uvicorn api:app
```

---

## 🔐 Переменные окружения

Все переменные в файле `.env`:
```
TELEGRAM_BOT_TOKEN=8959833473:AAHV7m-9V...
BACKEND_URL=http://host.docker.internal:8080
LOG_LEVEL=INFO
```

Для локальной разработки убедись, что `.env` присутствует!

---

## 💾 Сохранение логов

```bash
# Сохранить логи в файл
docker logs telegram-bot-xray > bot_logs.txt

# С временем
docker logs telegram-bot-xray --timestamps > bot_logs_time.txt
```
