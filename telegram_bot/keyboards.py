import logging
from telebot import types

logger = logging.getLogger(__name__)

# Сообщения
MESSAGES = {
    'welcome': (
        "👋 Добро пожаловать в KanbanDocky Bot!\n\n"
        "Я помогу вам получать уведомления о ваших проектах, группах и задачах.\n\n"
        "Для начала, пожалуйста, авторизуйтесь."
    ),
    'enter_email': "📧 Введите вашу почту (email) для входа:",
    'enter_password': "🔐 Введите ваш пароль:",
    'login_success': "✅ Вы успешно авторизованы!",
    'login_failed': "❌ Неверные учетные данные. Попробуйте еще раз.",
    'already_logged_in': "✅ Вы уже авторизованы в системе.",
}

# Состояния пользователя
USER_STATES = {
    'waiting_email': 'waiting_for_email',
    'waiting_password': 'waiting_for_password',
    'authenticated': 'authenticated',
}


def login_menu():
    """Меню входа"""
    keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    keyboard.add("📧 Вход по Email")
    keyboard.add("🔐 Вход через Google", "🔐 Вход через Yandex")
    keyboard.add("🔐 Вход через GitHub")
    return keyboard


def main_menu():
    """Главное меню"""
    keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True)
    keyboard.add("⚙️ Настройки уведомлений")
    keyboard.add("📊 Статистика", "❓ Помощь")
    keyboard.add("🚪 Выход")
    return keyboard


def settings_menu():
    """Меню настроек"""
    keyboard = types.InlineKeyboardMarkup()
    keyboard.add(
        types.InlineKeyboardButton(
            "🔔 Общие уведомления",
            callback_data="settings_general"
        )
    )
    keyboard.add(
        types.InlineKeyboardButton(
            "📋 Уведомления по проектам",
            callback_data="settings_projects"
        )
    )
    keyboard.add(
        types.InlineKeyboardButton(
            "🏷️ Уведомления по типам",
            callback_data="settings_types"
        )
    )
    return keyboard


def general_settings_menu(notifications_enabled):
    """Меню общих настроек"""
    keyboard = types.InlineKeyboardMarkup()
    status = "✅ Включены" if notifications_enabled else "❌ Отключены"
    keyboard.add(
        types.InlineKeyboardButton(
            f"Все уведомления: {status}",
            callback_data=f"toggle_all_{not notifications_enabled}"
        )
    )
    keyboard.add(
        types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data="settings_menu"
        )
    )
    return keyboard


def projects_menu(projects):
    """Меню проектов для настройки"""
    keyboard = types.InlineKeyboardMarkup()
    
    if not projects:
        keyboard.add(
            types.InlineKeyboardButton(
                "Проекты не найдены",
                callback_data="empty"
            )
        )
    else:
        for project_id, project_name in projects:
            keyboard.add(
                types.InlineKeyboardButton(
                    f"📋 {project_name}",
                    callback_data=f"project_{project_id}"
                )
            )
    
    keyboard.add(
        types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data="settings_menu"
        )
    )
    return keyboard


def project_settings_menu(project_id, project_name, enabled):
    """Меню настроек проекта"""
    keyboard = types.InlineKeyboardMarkup()
    status = "✅ Включены" if enabled else "❌ Отключены"
    keyboard.add(
        types.InlineKeyboardButton(
            f"Уведомления: {status}",
            callback_data=f"toggle_project_{project_id}_{not enabled}"
        )
    )
    keyboard.add(
        types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data="settings_projects"
        )
    )
    return keyboard


NOTIFICATION_TYPES = {
    "project": "📋 Уведомления о проекте",
    "group": "👥 Уведомления о группе",
    "task": "✅ Уведомления о задаче"
}


def notification_types_menu(project_id=None):
    """Меню типов уведомлений"""
    keyboard = types.InlineKeyboardMarkup()
    prefix = f"project_" if project_id else ""
    
    for type_key, type_name in NOTIFICATION_TYPES.items():
        keyboard.add(
            types.InlineKeyboardButton(
                type_name,
                callback_data=f"{prefix}type_{project_id}_{type_key}" if project_id 
                else f"type_{type_key}"
            )
        )
    
    back_callback = f"project_{project_id}" if project_id else "settings_menu"
    keyboard.add(
        types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data=back_callback
        )
    )
    return keyboard


def notification_type_settings_menu(type_key, type_name, enabled, project_id=None):
    """Меню настроек типа уведомления"""
    keyboard = types.InlineKeyboardMarkup()
    status = "✅ Включены" if enabled else "❌ Отключены"
    
    prefix = f"project_" if project_id else ""
    toggle_callback = (
        f"{prefix}toggle_type_{project_id}_{type_key}_{not enabled}"
        if project_id
        else f"toggle_type_{type_key}_{not enabled}"
    )
    
    keyboard.add(
        types.InlineKeyboardButton(
            f"{type_name}: {status}",
            callback_data=toggle_callback
        )
    )
    
    back_callback = f"project_types_{project_id}" if project_id else "settings_types"
    keyboard.add(
        types.InlineKeyboardButton(
            "⬅️ Назад",
            callback_data=back_callback
        )
    )
    return keyboard


def cancel_keyboard():
    """Клавиатура отмены"""
    keyboard = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    keyboard.add("❌ Отмена")
    return keyboard
