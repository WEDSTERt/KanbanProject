#!/bin/bash

cd /app/telegram_bot

# Запустить оба процесса параллельно используя exec replacement
(python -m uvicorn api:app --host 0.0.0.0 --port 8000) &
(python main.py) &

# Жди всех фоновых процессов
wait
