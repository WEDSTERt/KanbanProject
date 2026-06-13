#!/usr/bin/env python3
"""
Проверка структуры таблицы users
"""
import logging
from database import Database

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

db = Database()
db.connect()

logger.info("=" * 80)
logger.info("🔍 Структура таблицы 'users':")
logger.info("=" * 80)

columns = db.fetch_all("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
""")

if columns:
    for col in columns:
        null_str = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
        logger.info(f"  {col['column_name']:20} | {col['data_type']:15} | {null_str}")
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ Проверка завершена")
else:
    logger.error("❌ Таблица users не найдена")

db.close()
