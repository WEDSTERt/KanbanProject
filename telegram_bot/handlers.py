import logging
from telebot import types
import keyboards
from database import (
    get_or_create_user,
    toggle_notifications,
    get_notification_settings,
    set_notification_setting
)

logger = logging.getLogger(__name__)

# Хранилище для защиты от race conditions при быстрых нажатиях
processing_states = {}


async def handle_start(message, db, bot):
    """Обработка команды /start"""
    chat_id = message.chat.id
    logger.info(f"🎯 handle_start: chat_id={chat_id}, username={message.from_user.username}")
    
    try:
        user = get_or_create_user(
            db,
            chat_id,
            username=message.from_user.username,
            first_name=message.from_user.first_name
        )
        logger.info(f"✅ Пользователь создан/получен: {user}")
        
        welcome_text = (
            f"👋 Привет, {message.from_user.first_name}!\n\n"
            "Я бот для управления уведомлениями вашего проекта Kanban.\n\n"
            "Мои возможности:\n"
            "✅ Уведомления о создании/удалении проектов\n"
            "✅ Уведомления о создании/удалении групп\n"
            "✅ Уведомления об изменении задач\n"
            "✅ Уведомления о просрочке задач\n"
            "✅ Гибкие настройки уведомлений\n\n"
            "Используйте кнопки ниже для управления настройками."
        )
        
        logger.info(f"📤 Отправка приветственного сообщения...")
        await bot.send_message(chat_id, welcome_text, reply_markup=keyboards.main_menu())
        logger.info(f"✅ Приветственное сообщение отправлено")
        
    except Exception as e:
        logger.error(f"❌ Ошибка в handle_start: {e}", exc_info=True)
        raise


async def handle_settings(message, db, bot):
    """Обработка нажатия кнопки настроек"""
    chat_id = message.chat.id
    logger.info(f"🎯 handle_settings: chat_id={chat_id}")
    
    text = (
        "⚙️ <b>Управление уведомлениями</b>\n\n"
        "Выберите, что вы хотите настроить:"
    )
    
    await bot.send_message(chat_id, text, reply_markup=keyboards.settings_menu(), parse_mode="HTML")
    logger.info(f"✅ Меню настроек отправлено")


async def handle_callback_query(call, db, bot):
    """Обработка нажатия кнопок"""
    callback_data = call.data
    chat_id = call.message.chat.id
    message_id = call.message.message_id
    user_id = call.from_user.id
    
    # Защита от race conditions
    state_key = f"{chat_id}_{callback_data}"
    if state_key in processing_states:
        logger.warning(f"⚠️ Уже обрабатывается: {state_key}, игнорируем дубликат")
        return
    
    processing_states[state_key] = True
    
    logger.info(f"🎯 Callback обработчик: user={user_id}, callback={callback_data}")
    
    try:
        if callback_data == "settings_menu":
            logger.debug(f"  → Открытие главного меню настроек")
            text = (
                "⚙️ <b>Управление уведомлениями</b>\n\n"
                "Выберите, что вы хотите настроить:"
            )
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.settings_menu(),
                parse_mode="HTML"
            )

        elif callback_data == "settings_general":
            logger.debug(f"  → Открытие общих настроек")
            user = db.fetch_one(
                "SELECT notifications_enabled FROM telegram_users WHERE telegram_id = %s",
                (chat_id,)
            )
            if not user:
                logger.error(f"❌ Пользователь {chat_id} не найден в БД")
                await bot.answer_callback_query(call.id, "Пользователь не найден", show_alert=True)
                return
                
            text = (
                "🔔 <b>Общие настройки уведомлений</b>\n\n"
                f"Статус: {'✅ Включены' if user['notifications_enabled'] else '❌ Отключены'}"
            )
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.general_settings_menu(user['notifications_enabled']),
                parse_mode="HTML"
            )
            logger.info(f"✅ Общие настройки отправлены")

        elif callback_data.startswith("toggle_all_"):
            logger.debug(f"  → Переключение всех уведомлений")
            enabled = callback_data.split("_")[-1] == "True"
            toggle_notifications(db, chat_id, enabled)
            status = "✅ Включены" if enabled else "❌ Отключены"
            text = (
                "🔔 <b>Общие настройки уведомлений</b>\n\n"
                f"Статус: {status}\n\n"
                "✅ Настройки обновлены!"
            )
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.general_settings_menu(enabled),
                parse_mode="HTML"
            )
            logger.info(f"✅ Уведомления переключены на {enabled}")

        elif callback_data == "settings_projects":
            logger.debug(f"  → Открытие настроек проектов")
            
            # Получить user_id авторизованного пользователя
            telegram_user = db.fetch_one(
                "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
                (chat_id,)
            )
            
            if not telegram_user or not telegram_user['user_id']:
                logger.warning(f"  ⚠️ Пользователь не авторизован")
                await bot.answer_callback_query(call.id, "❌ Вы не авторизованы", show_alert=True)
                return
            
            user_id = telegram_user['user_id']
            logger.info(f"  🔍 Получение проектов для пользователя {user_id}")
            
            # Получить только проекты, где пользователь является участником
            # Включаем проекты где пользователь либо владелец, либо участник через project_members
            projects = db.fetch_all("""
                SELECT DISTINCT p.id, p.name, u.full_name as owner_name
                FROM projects p
                LEFT JOIN users u ON p.owner_user_id = u.id
                WHERE p.owner_user_id = %s 
                   OR p.id IN (
                       SELECT project_id FROM project_members 
                       WHERE user_id = %s
                   )
                ORDER BY p.name
            """, (user_id, user_id))
            
            if projects:
                logger.info(f"  ℹ️ Найдено проектов: {len(projects)}")
                for p in projects:
                    logger.debug(f"    - {p['name']} (от {p['owner_name']})")
                # Форматируем для меню - передаём кортежи (id, display_name)
                formatted_projects = [
                    (p['id'], f"{p['name']} (от {p['owner_name'] or 'N/A'})") 
                    for p in projects
                ]
            else:
                logger.warning(f"  ⚠️ Проекты не найдены. Пользователь не участник ни одного проекта")
                formatted_projects = []
                
            text = "📋 <b>Уведомления по проектам</b>\n\nВыберите проект:"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.projects_menu(formatted_projects),
                parse_mode="HTML"
            )

        elif callback_data.startswith("project_") and not callback_data.startswith("project_types_"):
            logger.debug(f"  → Открытие настроек проекта")
            project_id_str = callback_data.split("_")[1]
            
            # Валидация ID проекта
            if not project_id_str.isdigit():
                logger.warning(f"  ⚠️ Некорректный ID проекта: {project_id_str}")
                return
            
            project_id = int(project_id_str)
            
            # Получить user_id текущего пользователя
            telegram_user = db.fetch_one(
                "SELECT user_id FROM telegram_users WHERE telegram_id = %s",
                (chat_id,)
            )
            
            if not telegram_user or not telegram_user['user_id']:
                logger.warning(f"  ⚠️ Пользователь не авторизован")
                await bot.answer_callback_query(call.id, "❌ Вы не авторизованы", show_alert=True)
                return
            
            user_id = telegram_user['user_id']
            
            # Получить информацию о проекте
            project = db.fetch_one("""
                SELECT p.id, p.name, u.full_name as owner_name, p.owner_user_id
                FROM projects p
                LEFT JOIN users u ON p.owner_user_id = u.id
                WHERE p.id = %s
            """, (project_id,))
            
            if not project:
                logger.warning(f"  ⚠️ Проект {project_id} не найден")
                await bot.answer_callback_query(call.id, "❌ Проект не найден", show_alert=True)
                return
            
            # Проверяем, является ли пользователь владельцем или членом проекта
            is_owner = project['owner_user_id'] == user_id
            
            is_member = None
            if not is_owner:
                is_member = db.fetch_one("""
                    SELECT 1 FROM project_members 
                    WHERE project_id = %s AND user_id = %s
                """, (project_id, user_id))
            
            if not is_owner and not is_member:
                logger.warning(f"  ⚠️ Пользователь {user_id} не имеет доступ к проекту {project_id}")
                await bot.answer_callback_query(call.id, "❌ У вас нет доступа к этому проекту", show_alert=True)
                return
            
            settings = get_notification_settings(db, chat_id, project_id=project_id)
            enabled = len(settings) > 0 and settings[0]['enabled']
            project_display = f"{project['name']} (от {project['owner_name'] or 'N/A'})"
            text = f"📋 <b>{project_display}</b>\n\nНастройки для этого проекта:"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.project_settings_menu(project_id, project_display, enabled),
                parse_mode="HTML"
            )
            logger.info(f"✅ Настройки проекта открыты")

        elif callback_data.startswith("toggle_project_"):
            logger.debug(f"  → Переключение проекта")
            parts = callback_data.split("_")
            project_id = int(parts[2])
            enabled = parts[3] == "True"
            set_notification_setting(db, chat_id, enabled, project_id=project_id)
            
            project = db.fetch_one("""
                SELECT p.id, p.name, u.full_name as owner_name
                FROM projects p
                LEFT JOIN users u ON p.owner_user_id = u.id
                WHERE p.id = %s
            """, (project_id,))
            
            status = "✅ Включены" if enabled else "❌ Отключены"
            project_display = f"{project['name']} (от {project['owner_name'] or 'N/A'})"
            text = f"📋 <b>{project_display}</b>\n\nНастройки для этого проекта:\n{status}"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.project_settings_menu(project_id, project_display, enabled),
                parse_mode="HTML"
            )
            logger.info(f"✅ Проект переключен на {enabled}")

        elif callback_data == "settings_types":
            logger.debug(f"  → Открытие настроек типов")
            text = "🏷️ <b>Уведомления по типам</b>\n\nВыберите тип уведомления:"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.notification_types_menu(),
                parse_mode="HTML"
            )
            logger.info(f"✅ Меню типов отправлено")

        elif callback_data.startswith("type_"):
            logger.debug(f"  → Выбран тип уведомления")
            type_key = callback_data.split("_")[1]
            settings = get_notification_settings(db, chat_id, notification_type=type_key)
            enabled = len(settings) > 0 and settings[0]['enabled']
            type_name = keyboards.NOTIFICATION_TYPES.get(type_key, type_key)
            text = f"🏷️ <b>{type_name}</b>"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.notification_type_settings_menu(type_key, type_name, enabled),
                parse_mode="HTML"
            )

        elif callback_data.startswith("toggle_type_"):
            logger.debug(f"  → Переключение типа уведомления")
            parts = callback_data.split("_")
            type_key = parts[2]
            enabled = parts[3] == "True"
            set_notification_setting(db, chat_id, enabled, notification_type=type_key)
            type_name = keyboards.NOTIFICATION_TYPES.get(type_key, type_key)
            status = "✅ Включены" if enabled else "❌ Отключены"
            text = f"🏷️ <b>{type_name}</b>\n\n{status}"
            await bot.edit_message_text(
                text,
                chat_id,
                message_id,
                reply_markup=keyboards.notification_type_settings_menu(type_key, type_name, enabled),
                parse_mode="HTML"
            )
            logger.info(f"✅ Тип {type_key} переключен на {enabled}")

        else:
            logger.warning(f"⚠️ Неизвестный callback: {callback_data}")

    except Exception as e:
        logger.error(f"❌ Ошибка обработки callback: {e}", exc_info=True)
        await bot.answer_callback_query(call.id, "❌ Произошла ошибка", show_alert=True)
    finally:
        # Удаляем из очереди обработки
        processing_states.pop(state_key, None)
