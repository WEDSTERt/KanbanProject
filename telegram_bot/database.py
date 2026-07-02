import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# ✅ ИСПРАВЛЕНИЕ: Явно загружаем .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
logger.info(f"📋 Loading .env from: {env_path}")
load_dotenv(env_path)

# ✅ Получаем переменные напрямую
DATASOURCE_URL = os.getenv("DATASOURCE_URL", "jdbc:postgresql://localhost:5432/postgres")
logger.info(f"📋 DATASOURCE_URL: {DATASOURCE_URL}")

# Парсим DATASOURCE_URL
if "jdbc:postgresql://" in DATASOURCE_URL:
    url_part = DATASOURCE_URL.replace("jdbc:postgresql://", "")
    if "/" in url_part:
        host_port, db_name = url_part.split("/", 1)
    else:
        host_port = url_part
        db_name = "postgres"
    
    if ":" in host_port:
        DB_HOST, DB_PORT_STR = host_port.split(":", 1)
    else:
        DB_HOST = host_port
        DB_PORT_STR = "5432"
    
    DB_PORT = int(DB_PORT_STR)
    DB_NAME = db_name
else:
    DB_HOST = "localhost"
    DB_PORT = 5432
    DB_NAME = "postgres"

DB_USER = os.getenv("DATASOURCE_USERNAME", "postgres")
DB_PASSWORD = os.getenv("DATASOURCE_PASSWORD", "password")

logger.info(f"✅ Database config: {DB_HOST}:{DB_PORT}/{DB_NAME}")


class Database:
    def __init__(self):
        self.connection = None
        logger.info(f"🗄️ Database объект инициализирован (host={DB_HOST}:{DB_PORT}, db={DB_NAME})")

    def connect(self):
        """Подключение к базе данных"""
        try:
            logger.info(f"🔌 Попытка подключения: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
            self.connection = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                cursor_factory=RealDictCursor
            )
            logger.info("✅ Подключение к БД успешно")
        except Exception as e:
            logger.error(f"❌ Ошибка подключения: {e}", exc_info=True)
            raise

    def close(self):
        """Закрытие соединения"""
        if self.connection:
            self.connection.close()
            logger.info("✅ Соединение закрыто")

    def execute(self, query, params=None):
        """Выполнение запроса"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                self.connection.commit()
                logger.debug(f"✅ Query executed: {query[:50]}...")
                return cursor
        except Exception as e:
            self.connection.rollback()
            logger.error(f"❌ Database execute error: {e}", exc_info=True)
            raise

    def fetch_one(self, query, params=None):
        """Получить одну строку"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                logger.debug(f"✅ Fetch one: {query[:50]}... → {result}")
                return result
        except Exception as e:
            logger.error(f"❌ Database fetch_one error: {e}", exc_info=True)
            if "transaction" in str(e).lower():
                logger.warning("⚠️ Попытка восстановления соединения...")
                try:
                    self.connection.rollback()
                except:
                    pass
            return None

    def fetch_all(self, query, params=None):
        """Получить все строки"""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchall()
                logger.debug(f"✅ Fetch all: {query[:50]}... → {len(result)} rows")
                return result
        except Exception as e:
            logger.error(f"❌ Database fetch_all error: {e}", exc_info=True)
            if "transaction" in str(e).lower():
                logger.warning("⚠️ Попытка восстановления соединения...")
                try:
                    self.connection.rollback()
                except:
                    pass
            return []

    def init_tables(self):
        """Инициализация таблиц"""
        try:
            logger.info("📦 Инициализация таблиц...")
            with self.connection.cursor() as cursor:
                logger.debug("  → Создание таблицы telegram_users...")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS telegram_users (
                        id SERIAL PRIMARY KEY,
                        telegram_id BIGINT UNIQUE NOT NULL,
                        user_id INT,
                        username VARCHAR(255),
                        first_name VARCHAR(255),
                        notifications_enabled BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                logger.debug("  ✅ telegram_users создана")

                logger.debug("  → Создание таблицы notification_settings...")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS notification_settings (
                        id SERIAL PRIMARY KEY,
                        telegram_user_id BIGINT NOT NULL REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
                        project_id INT,
                        notification_type VARCHAR(50),
                        enabled BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(telegram_user_id, project_id, notification_type)
                    )
                """)
                logger.debug("  ✅ notification_settings создана")

                logger.debug("  → Создание таблицы notification_log...")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS notification_log (
                        id SERIAL PRIMARY KEY,
                        telegram_user_id BIGINT NOT NULL REFERENCES telegram_users(telegram_id),
                        notification_type VARCHAR(50),
                        project_id INT,
                        group_id INT,
                        task_id INT,
                        message TEXT,
                        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                logger.debug("  ✅ notification_log создана")

                self.connection.commit()
                logger.info("✅ Все таблицы инициализированы успешно")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации таблиц: {e}", exc_info=True)
            raise


# Функции для работы с пользователями
def get_or_create_user(db, telegram_id, username=None, first_name=None):
    """Получить или создать пользователя Telegram"""
    logger.info(f"👤 get_or_create_user: id={telegram_id}, username={username}")
    
    user = db.fetch_one(
        "SELECT * FROM telegram_users WHERE telegram_id = %s",
        (telegram_id,)
    )

    if user:
        logger.info(f"✅ Пользователь найден в БД")
        return user

    logger.info(f"➕ Создание нового пользователя...")
    db.execute(
        """INSERT INTO telegram_users (telegram_id, username, first_name)
           VALUES (%s, %s, %s)""",
        (telegram_id, username, first_name)
    )
    logger.info(f"✅ Пользователь создан")
    
    return db.fetch_one(
        "SELECT * FROM telegram_users WHERE telegram_id = %s",
        (telegram_id,)
    )


def toggle_notifications(db, telegram_id, enabled):
    """Включить/отключить все уведомления пользователя"""
    logger.info(f"🔔 toggle_notifications: id={telegram_id}, enabled={enabled}")
    db.execute(
        "UPDATE telegram_users SET notifications_enabled = %s WHERE telegram_id = %s",
        (enabled, telegram_id)
    )
    logger.info(f"✅ Уведомления обновлены")


def get_notification_settings(db, telegram_id, project_id=None, notification_type=None):
    """Получить настройки уведомлений"""
    logger.debug(f"⚙️ get_notification_settings: id={telegram_id}, project={project_id}, type={notification_type}")
    
    query = "SELECT * FROM notification_settings WHERE telegram_user_id = %s"
    params = [telegram_id]

    if project_id:
        query += " AND project_id = %s"
        params.append(project_id)

    if notification_type:
        query += " AND notification_type = %s"
        params.append(notification_type)

    return db.fetch_all(query, tuple(params))


def set_notification_setting(db, telegram_id, enabled, project_id=None, notification_type=None):
    """Установить настройку уведомления"""
    logger.info(f"📝 set_notification_setting: id={telegram_id}, project={project_id}, type={notification_type}, enabled={enabled}")
    try:
        db.execute(
            """INSERT INTO notification_settings 
               (telegram_user_id, project_id, notification_type, enabled)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (telegram_user_id, project_id, notification_type)
               DO UPDATE SET enabled = %s""",
            (telegram_id, project_id, notification_type, enabled, enabled)
        )
        logger.info(f"✅ Настройка обновлена")
    except Exception as e:
        logger.error(f"❌ Ошибка при установке настройки: {e}", exc_info=True)


def get_users_for_notification(db, notification_type, project_id=None):
    """Получить пользователей, которым отправить уведомление"""
    logger.debug(f"📢 get_users_for_notification: type={notification_type}, project={project_id}")
    
    query = """
        SELECT DISTINCT tu.telegram_id 
        FROM telegram_users tu
        WHERE tu.notifications_enabled = TRUE
    """
    params = []

    # Если есть настройка для этого типа уведомления
    query += """
        AND (
            SELECT COUNT(*) FROM notification_settings ns
            WHERE ns.telegram_user_id = tu.telegram_id
            AND ns.notification_type = %s
            AND ns.enabled = TRUE
    """
    params.append(notification_type)

    if project_id:
        query += " AND (ns.project_id = %s OR ns.project_id IS NULL)"
        params.append(project_id)
    else:
        query += " AND ns.project_id IS NULL"

    query += ") > 0"

    users = db.fetch_all(query, tuple(params))
    logger.info(f"✅ Найдено пользователей: {len(users)}")
    return users


def log_notification(db, telegram_id, notification_type, project_id=None, 
                    group_id=None, task_id=None, message=None):
    """Логирование отправленного уведомления"""
    logger.debug(f"📋 log_notification: id={telegram_id}, type={notification_type}")
    db.execute(
        """INSERT INTO notification_log 
           (telegram_user_id, notification_type, project_id, group_id, task_id, message)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (telegram_id, notification_type, project_id, group_id, task_id, message)
    )
