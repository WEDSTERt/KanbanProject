FROM python:3.10-slim

# Установить зависимости ОС
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Создать рабочую директорию
WORKDIR /app

# Скопировать entrypoint скрипт
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Скопировать бота
COPY telegram_bot/ /app/telegram_bot/

# Установить Python зависимости
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir bcrypt==4.1.2 aiohttp==3.9.1 pyTelegramBotAPI==4.14.0 python-dotenv==1.0.0 psycopg2-binary==2.9.9 fastapi uvicorn requests pydantic

# Volumes для логов
VOLUME ["/app/telegram_bot"]

# Запустить launcher для обоих процессов
WORKDIR /app/telegram_bot
CMD ["python", "launcher.py"]
