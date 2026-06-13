"""
API модуль для интеграции с основным приложением.
Для отправки уведомлений из основного приложения на Python/Java.
"""

import logging
import requests
from notifications import NotificationManager, Notification, NotificationType, NotificationEvent
from database import Database

logger = logging.getLogger(__name__)


class NotificationAPI:
    """API для отправки уведомлений из основного приложения"""
    
    def __init__(self, db, bot):
        self.db = db
        self.notification_manager = NotificationManager(db, bot)

    async def send_project_notification(self, event_type, project_id, project_name, 
                                       description=None, changes=None, user_ids=None):
        """
        Отправить уведомление о проекте
        
        Args:
            event_type: "created" | "deleted" | "updated"
            project_id: ID проекта
            project_name: Название проекта
            description: Описание (для created)
            changes: Описание изменений (для updated)
            user_ids: Список ID пользователей для отправки
        """
        event_map = {
            "created": NotificationEvent.PROJECT_CREATED,
            "deleted": NotificationEvent.PROJECT_DELETED,
            "updated": NotificationEvent.PROJECT_UPDATED,
        }
        
        data = {"name": project_name}
        if description:
            data["description"] = description
        if changes:
            data["changes"] = changes

        notification = Notification(
            NotificationType.PROJECT,
            event_map.get(event_type),
            project_id,
            data=data
        )
        
        telegram_ids = await self.notification_manager._get_telegram_ids_for_users(
            user_ids or [],
            project_id
        )
        await self.notification_manager.send_notification(notification, telegram_ids)

    async def send_group_notification(self, event_type, project_id, project_name, 
                                     group_id, group_name, description=None, user_ids=None):
        """
        Отправить уведомление о группе
        
        Args:
            event_type: "created" | "deleted" | "updated"
            project_id: ID проекта
            project_name: Название проекта
            group_id: ID группы
            group_name: Название группы
            description: Описание
            user_ids: Список ID пользователей
        """
        event_map = {
            "created": NotificationEvent.GROUP_CREATED,
            "deleted": NotificationEvent.GROUP_DELETED,
            "updated": NotificationEvent.GROUP_UPDATED,
        }
        
        data = {
            "project_name": project_name,
            "name": group_name
        }
        if description:
            data["description"] = description

        notification = Notification(
            NotificationType.GROUP,
            event_map.get(event_type),
            project_id,
            group_id=group_id,
            data=data
        )
        
        telegram_ids = await self.notification_manager._get_telegram_ids_for_users(
            user_ids or [],
            project_id
        )
        await self.notification_manager.send_notification(notification, telegram_ids)

    async def send_task_notification(self, event_type, project_id, project_name,
                                    group_id, group_name, task_id, title,
                                    priority=None, old_status=None, new_status=None,
                                    due_date=None, days_overdue=None, user_ids=None):
        """
        Отправить уведомление о задаче
        
        Args:
            event_type: "created" | "deleted" | "updated" | "status_changed" | "overdue"
            project_id: ID проекта
            project_name: Название проекта
            group_id: ID группы
            group_name: Название группы
            task_id: ID задачи
            title: Название задачи
            priority: Приоритет (для created)
            old_status: Старый статус (для status_changed)
            new_status: Новый статус (для status_changed)
            due_date: Дата дедлайна (для overdue)
            days_overdue: Кол-во дней просрочки (для overdue)
            user_ids: Список ID пользователей
        """
        event_map = {
            "created": NotificationEvent.TASK_CREATED,
            "deleted": NotificationEvent.TASK_DELETED,
            "updated": NotificationEvent.TASK_UPDATED,
            "status_changed": NotificationEvent.TASK_STATUS_CHANGED,
            "overdue": NotificationEvent.TASK_OVERDUE,
        }
        
        data = {
            "project_name": project_name,
            "group_name": group_name,
            "title": title
        }
        
        if priority:
            data["priority"] = priority
        if old_status:
            data["old_status"] = old_status
        if new_status:
            data["new_status"] = new_status
        if due_date:
            data["due_date"] = due_date
        if days_overdue:
            data["days_overdue"] = days_overdue

        notification = Notification(
            NotificationType.TASK,
            event_map.get(event_type),
            project_id,
            group_id=group_id,
            task_id=task_id,
            data=data
        )
        
        telegram_ids = await self.notification_manager._get_telegram_ids_for_users(
            user_ids or [],
            project_id
        )
        await self.notification_manager.send_notification(notification, telegram_ids)


# REST API для интеграции с основным приложением
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Kanban Telegram Bot API")


class ProjectNotificationRequest(BaseModel):
    event_type: str  # created, deleted, updated
    project_id: int
    project_name: str
    description: str = None
    changes: str = None
    user_ids: list = None


class GroupNotificationRequest(BaseModel):
    event_type: str
    project_id: int
    project_name: str
    group_id: int
    group_name: str
    description: str = None
    user_ids: list = None


class TaskNotificationRequest(BaseModel):
    event_type: str  # created, deleted, updated, status_changed, overdue
    project_id: int
    project_name: str
    group_id: int
    group_name: str
    task_id: int
    title: str
    priority: str = None
    old_status: str = None
    new_status: str = None
    due_date: str = None
    days_overdue: int = None
    user_ids: list = None


@app.post("/api/notify/project")
async def notify_project(request: ProjectNotificationRequest):
    """Отправить уведомление о проекте"""
    try:
        api = NotificationAPI(db, bot)
        await api.send_project_notification(
            request.event_type,
            request.project_id,
            request.project_name,
            request.description,
            request.changes,
            request.user_ids
        )
        return {"status": "ok", "message": "Notification sent"}
    except Exception as e:
        logger.error(f"Error sending project notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify/group")
async def notify_group(request: GroupNotificationRequest):
    """Отправить уведомление о группе"""
    try:
        api = NotificationAPI(db, bot)
        await api.send_group_notification(
            request.event_type,
            request.project_id,
            request.project_name,
            request.group_id,
            request.group_name,
            request.description,
            request.user_ids
        )
        return {"status": "ok", "message": "Notification sent"}
    except Exception as e:
        logger.error(f"Error sending group notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify/task")
async def notify_task(request: TaskNotificationRequest):
    """Отправить уведомление о задаче"""
    try:
        api = NotificationAPI(db, bot)
        await api.send_task_notification(
            request.event_type,
            request.project_id,
            request.project_name,
            request.group_id,
            request.group_name,
            request.task_id,
            request.title,
            request.priority,
            request.old_status,
            request.new_status,
            request.due_date,
            request.days_overdue,
            request.user_ids
        )
        return {"status": "ok", "message": "Notification sent"}
    except Exception as e:
        logger.error(f"Error sending task notification: {e}")
        raise HTTPException(status_code=500, detail=str(e))
