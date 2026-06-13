import logging
import sys
import asyncio
from config import BOT_TOKEN, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
from database import Database

# Конфигурация логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.FileHandler('bot_debug.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def check_config():
    """Проверка конфигурации"""
    logger.info("=" * 80)
    logger.info("🔍 ПРОВЕРКА КОНФИГУРАЦИИ БОТА")
    logger.info("=" * 80)
    
    logger.info(f"BOT_TOKEN: {BOT_TOKEN[:20]}... (скрыто)" if BOT_TOKEN else "BOT_TOKEN: НЕ НАЙДЕН ❌")
    logger.info(f"DB_HOST: {DB_HOST}")
    logger.info(f"DB_PORT: {DB_PORT}")
    logger.info(f"DB_NAME: {DB_NAME}")
    logger.info(f"DB_USER: {DB_USER}")
    
    if not BOT_TOKEN:
        logger.error("❌ TELEGRAM_BOT_TOKEN не найден в .env файле!")
        return False
    
    logger.info("✅ Конфигурация загружена успешно")
    return True

def check_database():
    """Проверка подключения к БД"""
    logger.info("=" * 80)
    logger.info("🗄️ ПРОВЕРКА БАЗЫ ДАННЫХ")
    logger.info("=" * 80)
    
    try:
        db = Database()
        db.connect()
        logger.info("✅ Подключение к БД успешно")
        
        # Проверка таблиц
        tables = db.fetch_all("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        if tables:
            logger.info(f"✅ Найдено таблиц: {len(tables)}")
            for table in tables:
                logger.info(f"  - {table['table_name']}")
        else:
            logger.warning("⚠️ Таблицы не найдены. Инициализирую...")
            db.init_tables()
            logger.info("✅ Таблицы инициализированы")
        
        # Проверка пользователей
        users = db.fetch_all("SELECT COUNT(*) as count FROM telegram_users")
        if users:
            logger.info(f"✅ Пользователей в БД: {users[0]['count']}")
        
        db.close()
        logger.info("✅ БД проверена успешно")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка БД: {e}", exc_info=True)
        return False

def check_bot_token():
    """Проверка валидности токена"""
    logger.info("=" * 80)
    logger.info("🤖 ПРОВЕРКА ТОКЕНА БОТА")
    logger.info("=" * 80)
    
    if not BOT_TOKEN:
        logger.error("❌ Токен не найден")
        return False
    
    # Проверка формата токена
    if ":" not in BOT_TOKEN:
        logger.error("❌ Неверный формат токена (должен содержать ':')")
        return False
    
    parts = BOT_TOKEN.split(":")
    if len(parts) != 2:
        logger.error(f"❌ Неверный формат токена (части: {len(parts)}, ожидается 2)")
        return False
    
    bot_id, bot_secret = parts
    
    if not bot_id.isdigit():
        logger.error("❌ ID бота содержит не-цифровые символы")
        return False
    
    if len(bot_secret) < 20:
        logger.error("❌ Secret токена слишком короткий")
        return False
    
    logger.info(f"✅ Формат токена корректен")
    logger.info(f"  Bot ID: {bot_id}")
    logger.info(f"  Secret: {bot_secret[:10]}... (скрыто)")
    return True

async def check_bot_api():
    """Проверка подключения к Telegram API"""
    logger.info("=" * 80)
    logger.info("📡 ПРОВЕРКА ПОДКЛЮЧЕНИЯ К TELEGRAM API")
    logger.info("=" * 80)
    
    try:
        from telebot.async_telebot import AsyncTeleBot
        
        bot = AsyncTeleBot(BOT_TOKEN)
        logger.info("✅ AsyncTeleBot инициализирован")
        
        # Проверка подключения
        try:
            me = await bot.get_me()
            logger.info(f"✅ Подключение к Telegram успешно!")
            logger.info(f"  Bot username: @{me.username}")
            logger.info(f"  Bot ID: {me.id}")
            logger.info(f"  Bot name: {me.first_name}")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка при подключении к Telegram: {e}", exc_info=True)
            return False
            
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации бота: {e}", exc_info=True)
        return False

def print_summary(results):
    """Печать итогов проверки"""
    logger.info("=" * 80)
    logger.info("📊 ИТОГИ ДИАГНОСТИКИ")
    logger.info("=" * 80)
    
    checks = [
        ("Конфигурация", results['config']),
        ("Токен бота", results['token']),
        ("База данных", results['database']),
        ("Telegram API", results['api']),
    ]
    
    all_passed = True
    for name, passed in checks:
        status = "✅" if passed else "❌"
        logger.info(f"{status} {name}")
        if not passed:
            all_passed = False
    
    logger.info("=" * 80)
    if all_passed:
        logger.info("🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!")
        logger.info("Бот готов к запуску.")
    else:
        logger.error("❌ НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОШЛИ!")
        logger.error("Исправьте ошибки перед запуском бота.")
    
    logger.info("=" * 80)
    
    return all_passed

async def main():
    """Главная функция диагностики"""
    logger.info("\n")
    logger.info("🚀 ЗАПУСК ДИАГНОСТИКИ TELEGRAM БОТА")
    logger.info("Время: %s", logging.Formatter().formatTime(logging.LogRecord(
        name="", level=0, pathname="", lineno=0, msg="", args=(), exc_info=None
    )))
    logger.info("\n")
    
    results = {
        'config': check_config(),
        'token': check_bot_token(),
        'database': check_database(),
        'api': await check_bot_api()
    }
    
    is_ready = print_summary(results)
    
    logger.info("\n📋 ЛОГИ СОХРАНЕНЫ В: bot_debug.log\n")
    
    return is_ready

if __name__ == "__main__":
    try:
        is_ready = asyncio.run(main())
        sys.exit(0 if is_ready else 1)
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}", exc_info=True)
        sys.exit(1)
