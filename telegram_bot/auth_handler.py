import logging
import asyncio
import bcrypt
from telebot import types
import keyboards
from database import get_or_create_user

logger = logging.getLogger(__name__)

# Хранить состояние пользователя в памяти (в боевом коде нужна БД)
user_states = {}
# Хранить ID сообщений для редактирования
message_ids = {}
# Хранить состояния OAuth
oauth_states = {}


async def handle_start_with_auth(message, db, bot):
    """Обработка /start - проверка аутентификации"""
    chat_id = message.chat.id
    username = message.from_user.username
    first_name = message.from_user.first_name
    
    logger.info(f"🎯 /start от {username} (ID: {chat_id})")
    
    # Удалить все предыдущие сообщения бота при нажатии /start
    try:
        if chat_id in message_ids:
            await bot.delete_message(chat_id, message_ids[chat_id])
            logger.debug(f"  ✅ Удалено предыдущее сообщение бота ID {message_ids[chat_id]}")
            del message_ids[chat_id]
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение бота: {e}")
    
    # Проверить, авторизован ли пользователь
    user = db.fetch_one(
        "SELECT * FROM telegram_users WHERE telegram_id = %s",
        (chat_id,)
    )
    
    if user and user['user_id']:
        # Уже авторизован
        logger.info(f"✅ Пользователь уже авторизован (user_id: {user['user_id']})")
        welcome_text = (
            f"👋 Привет, {first_name}!\n\n"
            f"✅ Вы уже авторизованы в системе.\n\n"
            "Мои возможности:\n"
            "✅ Уведомления о проектах\n"
            "✅ Уведомления о группах\n"
            "✅ Уведомления о задачах\n"
            "✅ Гибкие настройки уведомлений\n\n"
            "Используйте кнопки ниже для управления настройками."
        )
        await bot.send_message(chat_id, welcome_text, reply_markup=keyboards.main_menu())
    else:
        # Нужна аутентификация
        logger.info(f"❌ Пользователь не авторизован, начинаем процесс входа")
        
        # Создать пользователя если его нет
        if not user:
            get_or_create_user(db, chat_id, username=username, first_name=first_name)
            logger.info(f"✅ Создан новый пользователь {chat_id}")
        
        welcome_text = keyboards.MESSAGES['welcome']
        user_states[chat_id] = 'waiting_for_choice'
        
        await bot.send_message(chat_id, welcome_text, reply_markup=keyboards.login_menu())


async def handle_login_email(message, db, bot):
    """Обработка ввода email"""
    chat_id = message.chat.id
    email = message.text.strip()
    
    logger.info(f"📧 Получен email от {chat_id}: {email}")
    
    # Удалить сообщение пользователя (ввод email)
    try:
        await bot.delete_message(chat_id, message.message_id)
        logger.debug(f"  ✅ Удалено сообщение пользователя ID {message.message_id}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение пользователя: {e}")
    
    # Удалить предыдущее сообщение бота о вводе email
    try:
        if chat_id in message_ids:
            await bot.delete_message(chat_id, message_ids[chat_id])
            logger.debug(f"  ✅ Удалено сообщение бота ID {message_ids[chat_id]}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение бота: {e}")
    
    # Проверить формат email
    if '@' not in email or '.' not in email:
        logger.warning(f"⚠️ Неверный формат email: {email}")
        msg = await bot.send_message(
            chat_id,
            "❌ Неверный формат email. Пожалуйста, введите корректный email:",
            reply_markup=keyboards.cancel_keyboard()
        )
        message_ids[chat_id] = msg.message_id
        logger.debug(f"  📨 Отправлено сообщение об ошибке ID {msg.message_id}")
        return
    
    # ✅ Проверить, существует ли аккаунт с таким email
    logger.info(f"  🔍 Проверка существования аккаунта с email: {email}")
    db_user = db.fetch_one(
        "SELECT id, email FROM users WHERE email = %s LIMIT 1",
        (email,)
    )
    
    if not db_user:
        logger.warning(f"❌ Аккаунт с email {email} не найден в системе")
        msg = await bot.send_message(
            chat_id,
            f"❌ Аккаунт с email <b>{email}</b> не найден в системе.\n\n"
            "Пожалуйста, проверьте email и попробуйте снова:",
            reply_markup=keyboards.cancel_keyboard(),
            parse_mode="HTML"
        )
        message_ids[chat_id] = msg.message_id
        logger.debug(f"  📨 Отправлено сообщение об ошибке ID {msg.message_id}")
        return
    
    logger.info(f"✅ Аккаунт найден: ID={db_user['id']}, email={email}")
    
    # Сохранить email в памяти и ID сообщения бота
    user_states[chat_id] = {
        'state': 'waiting_for_password',
        'email': email
    }
    
    logger.info(f"✅ Email сохранён: {email}")
    
    # Отправляем новое сообщение о вводе пароля
    try:
        msg = await bot.send_message(
            chat_id,
            f"🔐 Введите пароль для {email}:",
            reply_markup=keyboards.cancel_keyboard()
        )
        message_ids[chat_id] = msg.message_id
        logger.debug(f"  📨 Отправлено сообщение ID {msg.message_id}")
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке сообщения: {e}")


async def handle_login_password(message, db, bot):
    """Обработка ввода пароля и проверка в основной системе"""
    chat_id = message.chat.id
    password = message.text.strip()
    
    logger.info(f"🔐 Получен ввод пароля от {chat_id}")
    
    # Удалить сообщение пользователя (ввод пароля)
    try:
        await bot.delete_message(chat_id, message.message_id)
        logger.debug(f"  ✅ Удалено сообщение пользователя ID {message.message_id}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение пользователя: {e}")
    
    if not isinstance(user_states.get(chat_id), dict):
        await bot.send_message(chat_id, "❌ Ошибка. Начните заново с /start")
        return
    
    email = user_states[chat_id].get('email')
    logger.info(f"🔐 Попытка входа: {email}")
    
    try:
        # Получить пользователя по email из основной БД
        db_user = db.fetch_one(
            "SELECT id, full_name, email, user_password FROM users WHERE email = %s LIMIT 1",
            (email,)
        )
        
        if not db_user:
            logger.warning(f"❌ Пользователь с email {email} не найден")
            await bot.send_message(
                chat_id,
                f"❌ Пользователь с email {email} не найден в системе.",
                reply_markup=keyboards.login_menu()
            )
            user_states[chat_id] = 'waiting_for_email'
            return
        
        logger.info(f"✅ Пользователь найден: ID={db_user['id']}, email={email}")
        
        # Проверить пароль
        stored_password = db_user['user_password']
        logger.debug(f"🔐 Проверка пароля с bcrypt...")
        
        is_password_correct = False
        
        try:
            # bcrypt проверка (пароль из БД должен быть в формате bcrypt hash)
            is_password_correct = bcrypt.checkpw(
                password.encode('utf-8'),
                stored_password.encode('utf-8')
            )
            logger.info(f"✅ bcrypt проверка прошла: {is_password_correct}")
        except ValueError as ve:
            logger.warning(f"⚠️ bcrypt ошибка (возможно пароль не в формате hash): {ve}")
            # Попробуем прямое сравнение как резервный вариант
            if password == stored_password:
                is_password_correct = True
                logger.info(f"✅ Пароль совпадает напрямую (не хеширован)")
        except Exception as e:
            logger.error(f"❌ Ошибка при проверке пароля: {e}")
            is_password_correct = False
        
        if is_password_correct:
            # Обновить user_id и telegram_chat_id в таблице users
            db.execute(
                "UPDATE users SET telegram_chat_id = %s WHERE id = %s",
                (chat_id, db_user['id'])
            )
            
            # Обновить user_id в таблице telegram_users
            db.execute(
                "UPDATE telegram_users SET user_id = %s WHERE telegram_id = %s",
                (db_user['id'], chat_id)
            )
            
            logger.info(f"✅ Пользователь {email} успешно авторизован")
            
            user_display_name = db_user['full_name']
            success_text = (
                f"✅ Вы успешно авторизованы!\n\n"
                f"Добро пожаловать, {user_display_name}!\n\n"
                "Теперь вы можете управлять своими уведомлениями."
            )
            
            user_states[chat_id] = 'authenticated'
            
            # Удалить предыдущее сообщение бота о вводе пароля
            try:
                if chat_id in message_ids:
                    await bot.delete_message(chat_id, message_ids[chat_id])
                    logger.debug(f"  ✅ Удалено сообщение бота ID {message_ids[chat_id]}")
            except Exception as e:
                logger.debug(f"  ⚠️ Не удалось удалить сообщение бота: {e}")
            
            await bot.send_message(
                chat_id,
                success_text,
                reply_markup=keyboards.main_menu()
            )
        else:
            logger.warning(f"❌ Неверный пароль для {email}")
            await bot.send_message(
                chat_id,
                "❌ Неверный пароль. Попробуйте еще раз.\n\n"
                "Используйте /start для повторного входа.",
                reply_markup=keyboards.login_menu()
            )
            user_states[chat_id] = 'waiting_for_email'
    
    except Exception as e:
        logger.error(f"❌ Ошибка при входе: {e}", exc_info=True)
        await bot.send_message(
            chat_id,
            "❌ Ошибка при входе. Попробуйте позже.",
            reply_markup=keyboards.login_menu()
        )
        user_states[chat_id] = 'waiting_for_email'


async def handle_logout(message, db, bot):
    """Выход из аккаунта"""
    chat_id = message.chat.id
    
    logger.info(f"🚪 Пользователь {chat_id} выходит из аккаунта")
    
    # Получить user_id перед очисткой
    user = db.fetch_one(
        "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
        (chat_id,)
    )
    
    # Очистить user_id (но сохранить telegram_id)
    db.execute(
        "UPDATE telegram_users SET user_id = NULL WHERE telegram_id = %s",
        (chat_id,)
    )
    
    # Очистить telegram_chat_id в основной таблице users
    if user and user['user_id']:
        db.execute(
            "UPDATE users SET telegram_chat_id = NULL WHERE id = %s",
            (user['user_id'],)
        )
    
    # Очистить состояние
    if chat_id in user_states:
        del user_states[chat_id]
    
    # Удалить сообщение пользователя (кнопка выхода)
    try:
        await bot.delete_message(chat_id, message.message_id)
        logger.debug(f"  ✅ Удалено сообщение пользователя ID {message.message_id}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
    
    logout_text = (
        "👋 Вы вышли из аккаунта.\n\n"
        "Используйте /start для повторного входа."
    )
    
    msg = await bot.send_message(
        chat_id,
        logout_text,
        reply_markup=keyboards.login_menu()
    )
    # Сохранить ID сообщения выхода для удаления при следующем /start
    message_ids[chat_id] = msg.message_id
    logger.debug(f"  📨 Отправлено сообщение выхода ID {msg.message_id}")


async def handle_cancel(message, db, bot):
    """Отмена процесса входа"""
    chat_id = message.chat.id
    
    logger.info(f"❌ Пользователь {chat_id} отменил процесс входа")
    
    # Удалить сообщение пользователя (кнопка отмены)
    try:
        await bot.delete_message(chat_id, message.message_id)
        logger.debug(f"  ✅ Удалено сообщение пользователя ID {message.message_id}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение: {e}")
    
    # Удалить последнее сообщение бота если оно есть
    try:
        if chat_id in message_ids:
            await bot.delete_message(chat_id, message_ids[chat_id])
            logger.debug(f"  ✅ Удалено сообщение бота ID {message_ids[chat_id]}")
    except Exception as e:
        logger.debug(f"  ⚠️ Не удалось удалить сообщение бота: {e}")
    
    if chat_id in user_states:
        del user_states[chat_id]
    
    cancel_text = (
        "❌ Процесс входа отменён.\n\n"
        "Используйте /start для повторного входа."
    )
    
    await bot.send_message(
        chat_id,
        cancel_text,
        reply_markup=types.ReplyKeyboardRemove()
    )


def is_authenticated(chat_id):
    """Проверить, авторизован ли пользователь"""
    return user_states.get(chat_id) == 'authenticated'


def get_user_state(chat_id):
    """Получить состояние пользователя"""
    return user_states.get(chat_id)


def set_user_state(chat_id, state):
    """Установить состояние пользователя"""
    user_states[chat_id] = state


def get_oauth_state(chat_id):
    """Получить OAuth state для пользователя"""
    return oauth_states.get(chat_id)


def set_oauth_state(chat_id, state):
    """Установить OAuth state для пользователя"""
    oauth_states[chat_id] = state


def remove_oauth_state(chat_id):
    """Удалить OAuth state для пользователя"""
    oauth_states.pop(chat_id, None)
