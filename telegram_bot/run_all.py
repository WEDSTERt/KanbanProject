"""
Запуск Telegram бота и FastAPI сервера одновременно
"""

import logging
import asyncio
import sys
import threading
from multiprocessing import Process
import uvicorn
from telebot.async_telebot import AsyncTeleBot
from config import BOT_TOKEN
from database import Database
from notifications import NotificationManager
import main as bot_main
import api

# Конфигурация логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('combined.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def run_telegram_bot():
    """Запустить Telegram бота в отдельном процессе"""
    logger.info("🤖 Запуск Telegram бота...")
    try:
        asyncio.run(bot_main.main())
    except Exception as e:
        logger.error(f"❌ Ошибка Telegram бота: {e}", exc_info=True)


def run_fastapi_server():
    """Запустить FastAPI сервер"""
    logger.info("🚀 Запуск FastAPI сервера...")
    
    # Инициализировать БД для API
    db = Database()
    db.connect()
    
    # Инициализировать бот (для отправки уведомлений)
    if not BOT_TOKEN:
        logger.error("❌ TELEGRAM_BOT_TOKEN не найден!")
        return
    
    bot = AsyncTeleBot(BOT_TOKEN)
    notification_manager = NotificationManager(db, bot)
    
    # Установить глобальные переменные для API
    api.set_api_instances(db, bot, notification_manager)
    
    try:
        uvicorn.run(
            api.app,
            host="0.0.0.0",
            port=8000,
            log_level="info"
        )
    except Exception as e:
        logger.error(f"❌ Ошибка FastAPI сервера: {e}", exc_info=True)
    finally:
        db.close()


def main():
    """Главная функция"""
    logger.info("=" * 80)
    logger.info("🎯 ЗАПУСК TELEGRAM BOT + FASTAPI ИНТЕГРАЦИИ")
    logger.info("=" * 80)
    
    # Запустить бота в отдельном потоке
    bot_thread = threading.Thread(target=run_telegram_bot, daemon=False)
    bot_thread.start()
    logger.info("✅ Telegram бот запущен в отдельном потоке")
    
    # Небольшая задержка перед запуском FastAPI
    asyncio.sleep(2)
    
    # Запустить FastAPI сервер в основном потоке
    run_fastapi_server()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("⏹️ Завершение работы...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}", exc_info=True)
        sys.exit(1)
