#!/usr/bin/env python3
"""
Проверка структуры таблицы projects
"""
import logging
from database import Database
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

db = Database()
db.connect()

# Получить структуру таблицы projects
logger.info("🔍 Структура таблицы 'projects':")
columns = db.fetch_all("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'projects'
    ORDER BY ordinal_position
""")

if columns:
    for col in columns:
        logger.info(f"  - {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
else:
    logger.error("❌ Таблица projects не найдена")

db.close()
