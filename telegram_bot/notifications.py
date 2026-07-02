import logging
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

# URL фронтенда
FRONTEND_URL = "https://kanbandocky.ru"


class NotificationType(Enum):
    PROJECT = "project"  # Добавление/удаление проекта
    GROUP = "group"      # Добавление/удаление группы
    TASK = "task"        # Добавление/изменение/удаление задачи, просрочка


class NotificationEvent(Enum):
    # Проект
    PROJECT_CREATED = "project_created"
    PROJECT_DELETED = "project_deleted"
    PROJECT_UPDATED = "project_updated"

    # Группа
    GROUP_CREATED = "group_created"
    GROUP_DELETED = "group_deleted"
    GROUP_UPDATED = "group_updated"

    # Задача
    TASK_CREATED = "task_created"
    TASK_DELETED = "task_deleted"
    TASK_UPDATED = "task_updated"
    TASK_STATUS_CHANGED = "task_status_changed"
    TASK_OVERDUE = "task_overdue"


class Notification:
    def __init__(self, notification_type, event, project_id, data=None, group_id=None, task_id=None):
        self.notification_type = notification_type
        self.event = event
        self.project_id = project_id
        self.group_id = group_id
        self.task_id = task_id
        self.data = data or {}
        self.timestamp = datetime.now()

    def _get_project_url(self):
        """Получить ссылку на проект"""
        if self.project_id:
            return f"{FRONTEND_URL}/board?projectId={self.project_id}"
        return ""

    def _get_group_url(self):
        """Получить ссылку на группу"""
        if self.project_id and self.group_id:
            return f"{FRONTEND_URL}/board?projectId={self.project_id}&subgroupId={self.group_id}"
        return ""

    def _get_task_url(self):
        """Получить ссылку на задачу"""
        if self.project_id and self.group_id and self.task_id:
            return f"{FRONTEND_URL}/board?projectId={self.project_id}&subgroupId={self.group_id}&highlightTask={self.task_id}"
        return ""

    def get_message(self):
        """Получить текст уведомления"""
        project_url = self._get_project_url()
        group_url = self._get_group_url()
        task_url = self._get_task_url()
        
        project_name = self.data.get('name', 'N/A')
        project_name_link = f'<a href="{project_url}">{project_name}</a>' if project_url else project_name
        
        project_name_full = self.data.get('project_name', 'N/A')
        project_name_full_link = f'<a href="{project_url}">{project_name_full}</a>' if project_url else project_name_full
        
        group_name = self.data.get('name', 'N/A')
        group_name_link = f'<a href="{group_url}">{group_name}</a>' if group_url else group_name
        
        group_name_full = self.data.get('group_name', 'N/A')
        group_name_full_link = f'<a href="{group_url}">{group_name_full}</a>' if group_url else group_name_full
        
        task_name = self.data.get('title', 'N/A')
        task_name_link = f'<a href="{task_url}">{task_name}</a>' if task_url else task_name
        
        messages = {
            NotificationEvent.PROJECT_CREATED.value: (
                f"📋 <b>Вас добавили в проект</b>\n"
                f"Название: {project_name_link}"
            ),
            NotificationEvent.PROJECT_DELETED.value: (
                f"📋 <b>Вас удалили из проекта</b>\n"
                f"Название: {project_name}"
            ),
            NotificationEvent.PROJECT_UPDATED.value: (
                f"📋 <b>Проект обновлен</b>\n"
                f"Название: {project_name_link}\n"
                f"Изменения: {self.data.get('changes', 'N/A')}"
            ),
            NotificationEvent.GROUP_CREATED.value: (
                f"👥 <b>Вас добавили в группу</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_link}\n"
                f"Описание: {self.data.get('description', 'Нет описания')}"
            ),
            NotificationEvent.GROUP_DELETED.value: (
                f"👥 <b>Вас удалили из группы</b>\n"
                f"Проект: {project_name_full}\n"
                f"Группа: {group_name}"
            ),
            NotificationEvent.GROUP_UPDATED.value: (
                f"👥 <b>Вас добавили в группу</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_link}"
            ),
            NotificationEvent.TASK_CREATED.value: (
                f"✅ <b>Новая задача</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_full_link}\n"
                f"Задача: {task_name_link}\n"
                f"Приоритет: {self.data.get('priority', 'N/A')}"
            ),
            NotificationEvent.TASK_DELETED.value: (
                f"✅ <b>Задача удалена</b>\n"
                f"Проект: {project_name_full}\n"
                f"Группа: {group_name_full}\n"
                f"Задача: {task_name}"
            ),
            NotificationEvent.TASK_UPDATED.value: (
                f"✅ <b>Задача обновлена</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_full_link}\n"
                f"Задача: {task_name_link}\n"
                f"Изменения: {self.data.get('changes', 'Нет описания')}"
            ),
            NotificationEvent.TASK_STATUS_CHANGED.value: (
                f"✅ <b>Статус задачи изменился</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_full_link}\n"
                f"Задача: {task_name_link}\n"
                f"Старый статус: {self.data.get('old_status', 'N/A')}\n"
                f"Новый статус: {self.data.get('new_status', 'N/A')}"
            ),
            NotificationEvent.TASK_OVERDUE.value: (
                f"⚠️ <b>ЗАДАЧА ПРОСРОЧЕНА</b>\n"
                f"Проект: {project_name_full_link}\n"
                f"Группа: {group_name_full_link}\n"
                f"Задача: {task_name_link}\n"
                f"Срок: {self.data.get('due_date', 'N/A')}\n"
                f"Дней просрочки: {self.data.get('days_overdue', 'N/A')}"
            ),
        }

        return messages.get(
            self.event.value,
            f"<b>Новое уведомление</b>\n{self.event.value}"
        )


class NotificationManager:
    def __init__(self, db, bot):
        self.db = db
        self.bot = bot

    async def send_notification(self, notification, telegram_ids):
        """Отправить уведомление пользователям"""
        if not telegram_ids:
            logger.warning("No telegram IDs to send notification to")
            return

        message = notification.get_message()

        for telegram_id in telegram_ids:
            try:
                await self.bot.send_message(
                    telegram_id,
                    message,
                    parse_mode="HTML"
                )
                logger.info(f"Notification sent to {telegram_id}")

                # Логирование уведомления
                from database import log_notification
                log_notification(
                    self.db,
                    telegram_id,
                    notification.notification_type.value,
                    project_id=notification.project_id,
                    group_id=notification.group_id,
                    task_id=notification.task_id,
                    message=message
                )
            except Exception as e:
                logger.error(f"Failed to send notification to {telegram_id}: {e}")

    async def notify_project_creation(self, project_id, project_name, description, user_ids):
        """Уведомление о создании проекта"""
        notification = Notification(
            NotificationType.PROJECT,
            NotificationEvent.PROJECT_CREATED,
            project_id,
            data={
                "name": project_name,
                "description": description or "Нет описания"
            }
        )
        telegram_ids = await self._get_telegram_ids_for_users(user_ids, project_id)
        await self.send_notification(notification, telegram_ids)

    async def notify_group_creation(self, project_id, project_name, group_id, group_name, 
                                    description, user_ids):
        """Уведомление о создании группы"""
        notification = Notification(
            NotificationType.GROUP,
            NotificationEvent.GROUP_CREATED,
            project_id,
            group_id=group_id,
            data={
                "project_name": project_name,
                "name": group_name,
                "description": description or "Нет описания"
            }
        )
        telegram_ids = await self._get_telegram_ids_for_users(user_ids, project_id)
        await self.send_notification(notification, telegram_ids)

    async def notify_task_creation(self, project_id, project_name, group_id, group_name,
                                  task_id, title, priority, user_ids):
        """Уведомление о создании задачи"""
        notification = Notification(
            NotificationType.TASK,
            NotificationEvent.TASK_CREATED,
            project_id,
            group_id=group_id,
            task_id=task_id,
            data={
                "project_name": project_name,
                "group_name": group_name,
                "title": title,
                "priority": priority or "Средняя"
            }
        )
        telegram_ids = await self._get_telegram_ids_for_users(user_ids, project_id)
        await self.send_notification(notification, telegram_ids)

    async def notify_task_status_change(self, project_id, project_name, group_id, group_name,
                                       task_id, title, old_status, new_status, user_ids):
        """Уведомление об изменении статуса задачи"""
        notification = Notification(
            NotificationType.TASK,
            NotificationEvent.TASK_STATUS_CHANGED,
            project_id,
            group_id=group_id,
            task_id=task_id,
            data={
                "project_name": project_name,
                "group_name": group_name,
                "title": title,
                "old_status": old_status,
                "new_status": new_status
            }
        )
        telegram_ids = await self._get_telegram_ids_for_users(user_ids, project_id)
        await self.send_notification(notification, telegram_ids)

    async def notify_task_overdue(self, project_id, project_name, group_id, group_name,
                                 task_id, title, due_date, days_overdue, user_ids):
        """Уведомление о просрочке задачи"""
        notification = Notification(
            NotificationType.TASK,
            NotificationEvent.TASK_OVERDUE,
            project_id,
            group_id=group_id,
            task_id=task_id,
            data={
                "project_name": project_name,
                "group_name": group_name,
                "title": title,
                "due_date": due_date,
                "days_overdue": days_overdue
            }
        )
        telegram_ids = await self._get_telegram_ids_for_users(user_ids, project_id)
        await self.send_notification(notification, telegram_ids)

    async def _get_telegram_ids_for_users(self, user_ids, project_id):
        """Получить Telegram ID пользователей, которым отправить уведомление"""
        # Здесь нужна логика получения Telegram ID из основной БД по user_id
        # Это должно быть реализовано в зависимости от вашей структуры БД
        from database import get_users_for_notification
        
        # Пока возвращаем все ID зарегистрированных пользователей
        users = self.db.fetch_all(
            "SELECT telegram_id FROM telegram_users WHERE notifications_enabled = TRUE"
        )
        return [user['telegram_id'] for user in users]
