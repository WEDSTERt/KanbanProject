"""
Точка входа для FastAPI с инициализацией API глобальных переменных
Запуск: uvicorn api_server:app --host 0.0.0.0 --port 8000
"""
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ИНИЦИАЛИЗИРОВАТЬ API ДО ЗАПУСКА UVICORN
logger.info("🔧 Pre-initializing API in api_server module...")

try:
    from database import Database
    from telebot.async_telebot import AsyncTeleBot
    from config import BOT_TOKEN
    from api import set_api_instances
    from notifications import NotificationManager
    
    # Создаем объекты БЕЗ запуска бота infinity_polling
    logger.info("Creating bot and database...")
    bot = AsyncTeleBot(BOT_TOKEN)
    db = Database()
    db.connect()
    db.init_tables()
    
    # Инициализируем API глобально в этом модуле
    notification_manager = NotificationManager(db, bot)
    set_api_instances(db, bot, notification_manager)
    logger.info("✅ API pre-initialized in api_server module!")
    
    # НЕ закрываем БД - она будет использована API
except Exception as e:
    logger.error(f"ERROR during pre-init: {e}", exc_info=True)
    import sys
    sys.exit(1)

# Теперь импортируем и экспортируем FastAPI app
from api import app

logger.info("✅ api_server ready to serve FastAPI app")
