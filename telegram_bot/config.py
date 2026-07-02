import os
from dotenv import load_dotenv
import logging

# Загружаем .env из корневой папки проекта
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

logger = logging.getLogger(__name__)

# Telegram Bot Configuration
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    logger.error("TELEGRAM_BOT_TOKEN не найден в .env файле!")
    raise ValueError("TELEGRAM_BOT_TOKEN не найден в .env файле!")

# URLs для Production/Development
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
OAUTH_REDIRECT_URI = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8080")
BACKEND_URL = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8080")  # Используем OAUTH_REDIRECT_URI как backend URL

logger.info(f"🌍 Frontend URL: {FRONTEND_URL}")
logger.info(f"🌐 Backend URL (OAuth): {BACKEND_URL}")

# Database Configuration из корневого .env
# Попытка 1: Прямые переменные
DB_HOST = os.getenv("DB_HOST")
DB_PORT_STR = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DATASOURCE_USERNAME", os.getenv("DB_USER", "postgres"))
DB_PASSWORD = os.getenv("DATASOURCE_PASSWORD", os.getenv("DB_PASSWORD", "password"))

# Попытка 2: Парсим из DATASOURCE_URL если прямые не установлены
if not DB_HOST:
    DATASOURCE_URL = os.getenv("DATASOURCE_URL", "jdbc:postgresql://localhost:5432/postgres")
    logger.info(f"📋 Парсим DATASOURCE_URL: {DATASOURCE_URL}")
    
    if "jdbc:postgresql://" in DATASOURCE_URL:
        # Пример: jdbc:postgresql://192.168.70.132:5432/postgres
        url_part = DATASOURCE_URL.replace("jdbc:postgresql://", "")
        logger.info(f"📋 URL part after removing prefix: {url_part}")
        
        # Разбираем хост и порт
        if "/" in url_part:
            host_port, db_name_part = url_part.split("/", 1)
            DB_NAME = db_name_part
        else:
            host_port = url_part
            DB_NAME = "postgres"
        
        if ":" in host_port:
            DB_HOST, DB_PORT_STR = host_port.split(":", 1)
        else:
            DB_HOST = host_port
            DB_PORT_STR = "5432"
    else:
        DB_HOST = "localhost"
        DB_PORT_STR = "5432"
        DB_NAME = "postgres"

# Преобразуем порт в число
DB_PORT = int(DB_PORT_STR) if DB_PORT_STR else 5432

logger.info(f"📊 Database config: {DB_HOST}:{DB_PORT}/{DB_NAME}")
logger.info(f"👤 Database user: {DB_USER}")

# Redis Configuration (для кэширования состояния пользователя)
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Notification Settings
CHECK_OVERDUE_INTERVAL = 3600  # Проверка просроченных задач каждый час

# Webhook Configuration
TELEGRAM_WEBHOOK_ENABLED = os.getenv("TELEGRAM_BOT_ENABLED", "true").lower() == "true"
TELEGRAM_WEBHOOK_URL = os.getenv("TELEGRAM_WEBHOOK_URL", "")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

# OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
YANDEX_CLIENT_ID = os.getenv("YANDEX_CLIENT_ID", "")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")


logger.info(f"🔐 OAuth Providers:")
logger.info(f"   Google: {GOOGLE_CLIENT_ID[:20]}..." if GOOGLE_CLIENT_ID else "   Google: NOT CONFIGURED")
logger.info(f"   Yandex: {YANDEX_CLIENT_ID[:20]}..." if YANDEX_CLIENT_ID else "   Yandex: NOT CONFIGURED")
logger.info(f"   GitHub: {GITHUB_CLIENT_ID[:20]}..." if GITHUB_CLIENT_ID else "   GitHub: NOT CONFIGURED")
