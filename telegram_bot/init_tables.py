#!/usr/bin/env python3
"""
Скрипт для инициализации таблиц бота в БД
"""
import logging
import sys
from config import DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
from database import Database

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def init_bot_tables():
    """Инициализация таблиц бота"""
    logger.info("=" * 80)
    logger.info("🔧 ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ TELEGRAM БОТА")
    logger.info("=" * 80)
    
    try:
        db = Database()
        logger.info(f"🔌 Подключение к БД: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
        db.connect()
        logger.info("✅ Подключение успешно")
        
        logger.info("\n📦 Создание таблиц...")
        db.init_tables()
        logger.info("✅ Все таблицы созданы успешно")
        
        # Проверка
        logger.info("\n🔍 Проверка таблиц...")
        tables = db.fetch_all("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('telegram_users', 'notification_settings', 'notification_log')
        """)
        
        if tables:
            logger.info(f"✅ Найдено таблиц: {len(tables)}")
            for table in tables:
                logger.info(f"  ✅ {table['table_name']}")
        else:
            logger.error("❌ Таблицы не найдены после создания!")
            return False
        
        db.close()
        logger.info("\n" + "=" * 80)
        logger.info("✅ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА УСПЕШНО!")
        logger.info("=" * 80)
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = init_bot_tables()
    sys.exit(0 if success else 1)
