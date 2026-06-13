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
# Парсим DATASOURCE_URL
DATASOURCE_URL = os.getenv("DATASOURCE_URL", "jdbc:postgresql://localhost:5432/postgres")

# Извлекаем параметры из JDBC URL
if "jdbc:postgresql://" in DATASOURCE_URL:
    # Пример: jdbc:postgresql://192.168.70.132:5432/postgres
    url_part = DATASOURCE_URL.replace("jdbc:postgresql://", "")
    if "/" in url_part:
        db_part, db_name = url_part.rsplit("/", 1)
        if ":" in db_part:
            DB_HOST, DB_PORT = db_part.split(":")
            DB_PORT = int(DB_PORT)
        else:
            DB_HOST = db_part
            DB_PORT = 5432
    else:
        DB_HOST = url_part.split(":")[0] if ":" in url_part else url_part
        DB_PORT = int(url_part.split(":")[1]) if ":" in url_part else 5432
        db_name = "postgres"
else:
    # Fallback
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    db_name = "kanban_bot"

DB_NAME = db_name
DB_USER = os.getenv("DATASOURCE_USERNAME", "postgres")
DB_PASSWORD = os.getenv("DATASOURCE_PASSWORD", "password")

logger.info(f"📊 Database config: {DB_HOST}:{DB_PORT}/{DB_NAME}")

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
