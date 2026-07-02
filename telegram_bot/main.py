import logging
import asyncio
import sys
import uuid
from telebot.async_telebot import AsyncTeleBot
from telebot import types
from config import BOT_TOKEN, LOG_LEVEL, BACKEND_URL
from database import Database
import handlers
import auth_handler
from oauth_webhook import OAuthWebhookHandler

# Конфигурация логирования с полной отладкой
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(funcName)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.FileHandler('bot.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

logger.info("="*80)
logger.info("🤖 ИНИЦИАЛИЗАЦИЯ TELEGRAM БОТА")
logger.info("="*80)

# Инициализация бота
if not BOT_TOKEN:
    logger.error("❌ TELEGRAM_BOT_TOKEN не найден!")
    sys.exit(1)

logger.info(f"✅ Токен загружен: {BOT_TOKEN[:20]}...")

bot = AsyncTeleBot(BOT_TOKEN)
logger.info(f"✅ AsyncTeleBot инициализирован")

db = Database()
logger.info(f"✅ Database объект создан")

# Инициализация webhook handler
oauth_webhook = OAuthWebhookHandler(db, bot)
logger.info(f"✅ OAuthWebhookHandler инициализирован")

# Хранилище для защиты от fast-click
processing_callbacks = set()

# Хранилище для отслеживания pending OAuth
pending_oauth_users = {}  # {telegram_id: {'state': state, 'timestamp': time}}


@bot.message_handler(commands=['start'])
async def start_handler(message):
    """Обработчик команды /start с аутентификацией"""
    logger.info(f"📨 Получена команда /start от пользователя {message.from_user.id} ({message.from_user.username})")
    try:
        await auth_handler.handle_start_with_auth(message, db, bot)
        logger.info(f"✅ /start обработана успешно")
    except Exception as e:
        logger.error(f"❌ Ошибка в start_handler: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "📧 Вход по Email")
async def email_button_handler(message):
    """Обработка нажатия на кнопку входа"""
    logger.info(f"📧 Нажата кнопка входа от {message.from_user.id}")
    try:
        # Удалить сообщение пользователя (кнопка входа)
        try:
            await bot.delete_message(message.chat.id, message.message_id)
            logger.debug(f"  ✅ Удалено сообщение пользователя ID {message.message_id}")
        except Exception as e:
            logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
        
        auth_handler.set_user_state(message.chat.id, 'waiting_for_email')
        msg = await bot.send_message(
            message.chat.id,
            "📧 Введите вашу почту (email) для входа:",
            reply_markup=auth_handler.keyboards.cancel_keyboard()
        )
        # Сохранить ID сообщения для последующего удаления
        auth_handler.message_ids[message.chat.id] = msg.message_id
        logger.debug(f"  📨 Отправлено сообщение ID {msg.message_id}")
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "🔐 Вход через Google" or message.text == "🔐 Войти с Google")
async def oauth_google_handler(message):
    """Обработка входа через Google"""
    logger.info(f"🔐 Нажата кнопка входа Google от {message.from_user.id}")
    try:
        # Удалить сообщение пользователя
        try:
            await bot.delete_message(message.chat.id, message.message_id)
        except Exception as e:
            logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
        
        # Генерируем уникальный state для этого пользователя
        state = f"tg_{message.chat.id}_{uuid.uuid4().hex}"
        
        # Сохранить telegram_id и provider в state
        auth_handler.set_oauth_state(message.chat.id, {
            'telegram_id': message.chat.id,
            'provider': 'google',
            'state': state
        })
        
        # Добавить в очередь pending OAuth для отслеживания
        pending_oauth_users[message.chat.id] = {
            'state': state,
            'provider': 'google',
            'timestamp': asyncio.get_event_loop().time()
        }
        logger.info(f"📋 Добавлен в pending_oauth_users для отслеживания: {message.chat.id}")
        
        # Формируем OAuth URL с параметром state
        oauth_url = f"{BACKEND_URL}/oauth2/authorization/google?state={state}"
        
        msg = await bot.send_message(
            message.chat.id,
            "🔐 <b>Вход через Google</b>\n\n"
            "Веб-приложение откроется в браузере. После авторизации вы будете автоматически подключены к боту.\n\n"
            f"<a href='{oauth_url}'>👉 Нажмите здесь для входа через Google</a>",
            parse_mode="HTML"
        )
        auth_handler.message_ids[message.chat.id] = msg.message_id
        logger.info(f"✅ Сообщение о Google OAuth отправлено. State: {state}")
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "🔐 Вход через Yandex" or message.text == "🔐 Войти с Yandex")
async def oauth_yandex_handler(message):
    """Обработка входа через Yandex"""
    logger.info(f"🔐 Нажата кнопка входа Yandex от {message.from_user.id}")
    try:
        # Удалить сообщение пользователя
        try:
            await bot.delete_message(message.chat.id, message.message_id)
        except Exception as e:
            logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
        
        # Генерируем уникальный state для этого пользователя
        state = f"tg_{message.chat.id}_{uuid.uuid4().hex}"
        
        # Сохранить telegram_id и provider в state
        auth_handler.set_oauth_state(message.chat.id, {
            'telegram_id': message.chat.id,
            'provider': 'yandex',
            'state': state
        })
        
        # Добавить в очередь pending OAuth для отслеживания
        pending_oauth_users[message.chat.id] = {
            'state': state,
            'provider': 'yandex',
            'timestamp': asyncio.get_event_loop().time()
        }
        logger.info(f"📋 Добавлен в pending_oauth_users для отслеживания: {message.chat.id}")
        
        # Формируем OAuth URL с параметром state
        oauth_url = f"{BACKEND_URL}/oauth2/authorization/yandex?state={state}"
        
        msg = await bot.send_message(
            message.chat.id,
            "🔐 <b>Вход через Yandex</b>\n\n"
            "Веб-приложение откроется в браузере. После авторизации вы будете автоматически подключены к боту.\n\n"
            f"<a href='{oauth_url}'>👉 Нажмите здесь для входа через Yandex</a>",
            parse_mode="HTML"
        )
        auth_handler.message_ids[message.chat.id] = msg.message_id
        logger.info(f"✅ Сообщение о Yandex OAuth отправлено. State: {state}")
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "🔐 Вход через GitHub" or message.text == "🔐 Войти с GitHub")
async def oauth_github_handler(message):
    """Обработка входа через GitHub"""
    logger.info(f"🔐 Нажата кнопка входа GitHub от {message.from_user.id}")
    try:
        # Удалить сообщение пользователя
        try:
            await bot.delete_message(message.chat.id, message.message_id)
        except Exception as e:
            logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
        
        # Генерируем уникальный state для этого пользователя
        state = f"tg_{message.chat.id}_{uuid.uuid4().hex}"
        
        # Сохранить telegram_id и provider в state
        auth_handler.set_oauth_state(message.chat.id, {
            'telegram_id': message.chat.id,
            'provider': 'github',
            'state': state
        })
        
        # Добавить в очередь pending OAuth для отслеживания
        pending_oauth_users[message.chat.id] = {
            'state': state,
            'provider': 'github',
            'timestamp': asyncio.get_event_loop().time()
        }
        logger.info(f"📋 Добавлен в pending_oauth_users для отслеживания: {message.chat.id}")
        
        # Формируем OAuth URL с параметром state
        oauth_url = f"{BACKEND_URL}/oauth2/authorization/github?state={state}"
        
        msg = await bot.send_message(
            message.chat.id,
            "🔐 <b>Вход через GitHub</b>\n\n"
            "Веб-приложение откроется в браузере. После авторизации вы будете автоматически подключены к боту.\n\n"
            f"<a href='{oauth_url}'>👉 Нажмите здесь для входа через GitHub</a>",
            parse_mode="HTML"
        )
        auth_handler.message_ids[message.chat.id] = msg.message_id
        logger.info(f"✅ Сообщение о GitHub OAuth отправлено. State: {state}")
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "❌ Отмена")
async def cancel_handler(message):
    """Обработка отмены"""
    logger.info(f"❌ Отмена от {message.from_user.id}")
    try:
        # Удалить из pending OAuth если есть
        pending_oauth_users.pop(message.chat.id, None)
        await auth_handler.handle_cancel(message, db, bot)
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text == "🚪 Выход")
async def logout_handler(message):
    """Обработка выхода"""
    logger.info(f"🚪 Выход от {message.from_user.id}")
    try:
        await auth_handler.handle_logout(message, db, bot)
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: auth_handler.get_user_state(message.chat.id) == 'waiting_for_email')
async def email_input_handler(message):
    """Обработка ввода email"""
    logger.info(f"📧 Получен ввод email от {message.from_user.id}")
    try:
        await auth_handler.handle_login_email(message, db, bot)
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: isinstance(auth_handler.get_user_state(message.chat.id), dict) and auth_handler.get_user_state(message.chat.id).get('state') == 'waiting_for_password')
async def password_input_handler(message):
    """Обработка ввода пароля"""
    logger.info(f"🔐 Получен ввод пароля от {message.from_user.id}")
    try:
        await auth_handler.handle_login_password(message, db, bot)
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}", exc_info=True)


@bot.message_handler(func=lambda message: "⚙️ Настройки" in message.text)
async def settings_handler(message):
    """Обработчик нажатия на кнопку настроек"""
    logger.info(f"📨 Нажата кнопка настроек от пользователя {message.from_user.id}")
    try:
        # Проверить аутентификацию
        user = db.fetch_one(
            "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
            (message.chat.id,)
        )
        if not user or not user['user_id']:
            await bot.send_message(message.chat.id, "❌ Сначала авторизуйтесь. Используйте /start")
            return
        
        await handlers.handle_settings(message, db, bot)
        logger.info(f"✅ Настройки открыты")
    except Exception as e:
        logger.error(f"❌ Ошибка в settings_handler: {e}", exc_info=True)


@bot.message_handler(func=lambda message: message.text in ["📊 Статистика", "❓ Помощь"])
async def info_handler(message):
    """Обработчик информационных команд"""
    logger.info(f"📨 Нажата информационная кнопка: {message.text} от {message.from_user.id}")
    chat_id = message.chat.id
    
    if "Статистика" in message.text:
        stats = db.fetch_one(
            "SELECT COUNT(*) as count FROM telegram_users WHERE notifications_enabled = TRUE"
        )
        text = f"📊 <b>Статистика</b>\n\nВключено уведомлений: {stats['count']}"
    else:
        text = (
            "❓ <b>Справка</b>\n\n"
            "<b>Типы уведомлений:</b>\n"
            "📋 Проекты - уведомления о создании/удалении проектов\n"
            "👥 Группы - уведомления о создании/удалении групп\n"
            "✅ Задачи - уведомления об изменении и просрочке задач\n\n"
            "<b>Гибкие настройки:</b>\n"
            "• Включить/отключить все уведомления\n"
            "• Выбрать уведомления для конкретного проекта\n"
            "• Выбрать уведомления определённого типа\n\n"
            "<b>Используйте кнопки главного меню для управления.</b>"
        )
    
    await bot.send_message(chat_id, text, parse_mode="HTML")
    logger.info(f"✅ Информационное сообщение отправлено")


@bot.callback_query_handler(func=lambda call: True)
async def callback_handler(call):
    """Обработчик всех callback кнопок"""
    logger.info(f"📨 Callback от {call.from_user.id}: {call.data}")
    
    # Защита от fast-click
    callback_key = f"{call.from_user.id}_{call.data}"
    if callback_key in processing_callbacks:
        logger.warning(f"⚠️ Fast-click обнаружен, игнорируем дубликат: {callback_key}")
        await bot.answer_callback_query(call.id)
        return
    
    processing_callbacks.add(callback_key)
    
    try:
        if call.data == "cancel_oauth":
            # Отмена OAuth
            await bot.answer_callback_query(call.id, "❌ Отмена входа")
            auth_handler.remove_oauth_state(call.message.chat.id)
            pending_oauth_users.pop(call.message.chat.id, None)
            return
        
        # Проверить аутентификацию
        user = db.fetch_one(
            "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
            (call.message.chat.id,)
        )
        if not user or not user['user_id']:
            await bot.answer_callback_query(call.id, "❌ Авторизуйтесь первой", show_alert=True)
            return
        
        await handlers.handle_callback_query(call, db, bot)
        await bot.answer_callback_query(call.id)
        logger.info(f"✅ Callback обработан успешно")
    except Exception as e:
        logger.error(f"❌ Ошибка в callback_handler: {e}", exc_info=True)
        await bot.answer_callback_query(call.id, "❌ Ошибка", show_alert=True)
    finally:
        # Удаляем из очереди обработки
        processing_callbacks.discard(callback_key)


@bot.message_handler(func=lambda message: True)
async def default_handler(message):
    """Обработчик остальных сообщений"""
    logger.info(f"📨 Получено сообщение от {message.from_user.id}: {message.text}")
    chat_id = message.chat.id
    text = (
        "Я не понимаю эту команду. 🤔\n\n"
        "Используйте кнопки главного меню для навигации."
    )
    await bot.send_message(chat_id, text)


async def check_oauth_completion():
    """
    ✅ НОВОЕ: Фоновая задача для проверки завершения OAuth авторизации
    Проверяет БД каждые 5 секунд на успешное привязание
    """
    logger.info("✅ Фоновая задача check_oauth_completion запущена")
    
    while True:
        try:
            current_time = asyncio.get_event_loop().time()
            timeout_seconds = 600  # 10 минут таймаут
            
            # Получить список pending OAuth пользователей
            for telegram_id, oauth_info in list(pending_oauth_users.items()):
                try:
                    # Проверить не истек ли таймаут
                    elapsed = current_time - oauth_info['timestamp']
                    if elapsed > timeout_seconds:
                        logger.info(f"⏱️ Таймаут OAuth для {telegram_id} ({elapsed:.0f}s), удаляем")
                        await oauth_webhook.send_oauth_link_expired_message(telegram_id)
                        pending_oauth_users.pop(telegram_id, None)
                        auth_handler.remove_oauth_state(telegram_id)
                        continue
                    
                    # Проверить появился ли user_id в telegram_users
                    user_record = db.fetch_one(
                        "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
                        (telegram_id,)
                    )
                    
                    if user_record and user_record['user_id']:
                        logger.info(f"✅ OAuth завершена для {telegram_id} (user_id={user_record['user_id']})")
                        
                        # Отправить уведомление пользователю
                        try:
                            provider = oauth_info.get('provider', 'unknown')
                            message = (
                                f"✅ <b>Авторизация успешна!</b>\n\n"
                                f"Вы вошли через {provider.upper()}.\n"
                                f"Ваш аккаунт привязан к Telegram.\n\n"
                                f"Теперь вы можете получать уведомления о проектах и задачах!"
                            )
                            
                            await bot.send_message(
                                telegram_id,
                                message,
                                parse_mode="HTML",
                                reply_markup=auth_handler.keyboards.main_menu()
                            )
                        except Exception as e:
                            logger.error(f"⚠️ Ошибка при отправке уведомления: {e}")
                        
                        # Удалить из pending
                        pending_oauth_users.pop(telegram_id, None)
                        auth_handler.remove_oauth_state(telegram_id)
                        
                except Exception as e:
                    logger.error(f"⚠️ Ошибка при проверке OAuth для {telegram_id}: {e}")
            
            await asyncio.sleep(5)  # Проверка каждые 5 секунд
            
        except Exception as e:
            logger.error(f"❌ Ошибка в check_oauth_completion: {e}", exc_info=True)
            await asyncio.sleep(60)


async def check_overdue_tasks():
    """Фоновая задача для проверки просроченных задач"""
    logger.info("✅ Фоновая задача check_overdue_tasks запущена")

    while True:
        try:
            logger.debug("🔍 Проверка просроченных задач...")
            # Здесь нужна логика для проверки просроченных задач в основной БД
            await asyncio.sleep(3600)  # Проверка каждый час
        except Exception as e:
            logger.error(f"❌ Ошибка в check_overdue_tasks: {e}", exc_info=True)
            await asyncio.sleep(60)


async def main():
    """Главная функция"""
    logger.info("🚀 Запуск Telegram Bot...")
    
    try:
        # Подключение к БД
        logger.info("📦 Подключение к базе данных...")
        db.connect()
        logger.info("✅ Подключение к БД успешно")
        
        db.init_tables()
        logger.info("✅ Таблицы инициализированы")
        
        # Проверка подключения к Telegram
        logger.info("📡 Проверка подключения к Telegram API...")
        max_retries = 5
        for attempt in range(max_retries):
            try:
                me = await bot.get_me()
                logger.info(f"✅ Подключение к Telegram успешно!")
                logger.info(f"   Bot: @{me.username} (ID: {me.id})")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 15  # 15, 30, 45, 60 сек
                    logger.warning(f"⚠️ Попытка подключения #{attempt + 1}/{max_retries} не удалась.")
                    logger.warning(f"   Ошибка: {str(e)[:100]}")
                    logger.warning(f"   Ожидание {wait_time} сек перед следующей попыткой...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"❌ Ошибка подключения к Telegram после {max_retries} попыток: {e}", exc_info=True)
                    raise
        
        # Запуск фоновых задач
        # 🔧 ИНИЦИАЛИЗИРОВАТЬ API С ГЛОБАЛЬНЫМИ ПЕРЕМЕННЫМИ
        logger.info("🔧 Инициализация API с глобальными переменными...")
        try:
            from api import set_api_instances
            from notifications import NotificationManager
            notification_manager = NotificationManager(db, bot)
            set_api_instances(db, bot, notification_manager)
            logger.info("✅ API полностью инициализирован и готов принимать запросы")
        except Exception as e:
            logger.error(f"⚠️ Ошибка при инициализации API: {e}", exc_info=True)
        
        # 🔧 ИНИЦИАЛИЗИРОВАТЬ API С ГЛОБАЛЬНЫМИ ПЕРЕМЕННЫМИ
        logger.info("🔧 Инициализация API с глобальными переменными...")
        try:
            from api import set_api_instances
            from notifications import NotificationManager
            notification_manager = NotificationManager(db, bot)
            set_api_instances(db, bot, notification_manager)
            logger.info("✅ API полностью инициализирован и готов принимать запросы")
        except Exception as e:
            logger.error(f"⚠️ Ошибка при инициализации API: {e}", exc_info=True)
        
        logger.info("⏰ Запуск фоновых задач...")
        
        oauth_task = asyncio.create_task(check_oauth_completion())
        logger.info("⏰ - Фоновая задача check_oauth_completion запущена")
        
        overdue_task = asyncio.create_task(check_overdue_tasks())
        logger.info("⏰ - Фоновая задача check_overdue_tasks запущена")
        
        try:
            # Запуск бота
            logger.info("=" * 80)
            logger.info("✅ БОТ ПОЛНОСТЬЮ ИНИЦИАЛИЗИРОВАН И ГОТОВ!")
            logger.info("=" * 80)
            logger.info("📨 Ожидание сообщений...")
            logger.info("   Команда: /start")
            logger.info("=" * 80)
            logger.info("")
            
            await bot.infinity_polling(skip_pending=True, logger_level=logging.DEBUG)
        except KeyboardInterrupt:
            logger.info("⏹️ Бот остановлен пользователем")
        finally:
            oauth_task.cancel()
            overdue_task.cancel()
            logger.info("🛑 Фоновые задачи отменены")
            
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}", exc_info=True)
    finally:
        logger.info("🔌 Закрытие соединения с БД...")
        db.close()
        logger.info("✅ Соединение закрыто")
        logger.info("=" * 80)
        logger.info("БОТ ОСТАНОВЛЕН")
        logger.info("=" * 80)


if __name__ == "__main__":
    logger.info("")
    logger.info("🎯 ЗАПУСК ОСНОВНОГО СКРИПТА")
    logger.info("")
    
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"❌ Критическая ошибка в главной программе: {e}", exc_info=True)
        sys.exit(1)
