"""
API модуль для интеграции с основным приложением.
Для отправки уведомлений из основного приложения на Python/Java.
"""

import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from notifications import NotificationManager, Notification, NotificationType, NotificationEvent
from database import Database

logger = logging.getLogger(__name__)

# Глобальные переменные для доступа из API
_db = None
_bot = None
_notification_manager = None


def set_api_instances(db, bot, notification_manager):
    """Установить глобальные переменные для API"""
    global _db, _bot, _notification_manager
    _db = db
    _bot = bot
    _notification_manager = notification_manager
    logger.info("✅ API instances установлены успешно")
    logger.info(f"   📊 _db: {type(_db).__name__}")
    logger.info(f"   🤖 _bot: {type(_bot).__name__}")
    logger.info(f"   📬 _notification_manager: {type(_notification_manager).__name__}")


def check_initialized():
    """Проверить что все инициализировано"""
    if _db is None:
        logger.error("❌ _db не инициализирован!")
        return False
    if _bot is None:
        logger.error("❌ _bot не инициализирован!")
        return False
    if _notification_manager is None:
        logger.error("❌ _notification_manager не инициализирован!")
        return False
    return True


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
            event_type: "user_added" | "user_removed" | "updated"
            project_id: ID проекта
            project_name: Название проекта
            description: Описание (для created)
            changes: Описание изменений (для updated)
            user_ids: Список ID пользователей для отправки
        """
        event_map = {
            "user_added": NotificationEvent.PROJECT_CREATED,      # Переиспользуем существующий тип
            "user_removed": NotificationEvent.PROJECT_DELETED,    # Переиспользуем существующий тип
            "updated": NotificationEvent.PROJECT_UPDATED,
        }
        
        event_enum = event_map.get(event_type)
        if event_enum is None:
            logger.warning(f"⚠️ Неизвестный тип события: {event_type}, используем PROJECT_UPDATED")
            event_enum = NotificationEvent.PROJECT_UPDATED
        
        data = {"name": project_name}
        if description:
            data["description"] = description
        if changes:
            data["changes"] = changes

        notification = Notification(
            NotificationType.PROJECT,
            event_enum,
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
            event_type: "user_added" | "user_removed" | "created" | "deleted" | "updated"
            project_id: ID проекта
            project_name: Название проекта
            group_id: ID группы
            group_name: Название группы
            description: Описание
            user_ids: Список ID пользователей
        """
        event_map = {
            "user_added": NotificationEvent.GROUP_CREATED,       # Переиспользуем существующий тип
            "user_removed": NotificationEvent.GROUP_DELETED,     # Переиспользуем существующий тип
            "created": NotificationEvent.GROUP_CREATED,
            "deleted": NotificationEvent.GROUP_DELETED,
            "updated": NotificationEvent.GROUP_UPDATED,
        }
        
        event_enum = event_map.get(event_type)
        if event_enum is None:
            logger.warning(f"⚠️ Неизвестный тип события для группы: {event_type}, используем GROUP_UPDATED")
            event_enum = NotificationEvent.GROUP_UPDATED
        
        data = {
            "project_name": project_name,
            "name": group_name
        }
        if description:
            data["description"] = description

        try:
            notification = Notification(
                NotificationType.GROUP,
                event_enum,
                project_id,
                group_id=group_id,
                data=data
            )
            
            telegram_ids = await self.notification_manager._get_telegram_ids_for_users(
                user_ids or [],
                project_id
            )
            await self.notification_manager.send_notification(notification, telegram_ids)
        except AttributeError as e:
            logger.error(f"❌ Ошибка при создании уведомления о группе: {e}")
            logger.error(f"   event_type: {event_type}, event_enum: {event_enum}")
            raise

    async def send_task_notification(self, event_type, project_id, project_name,
                                    group_id, group_name, task_id, title,
                                    priority=None, old_status=None, new_status=None,
                                    due_date=None, days_overdue=None, user_ids=None):
        """
        Отправить уведомление о задаче
        
        Args:
            event_type: "created" | "deleted" | "updated" | "assigned" | "overdue"
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
            "assigned": NotificationEvent.TASK_CREATED,  # Переиспользуем существующий тип
            "overdue": NotificationEvent.TASK_OVERDUE,
        }
        
        event_enum = event_map.get(event_type)
        if event_enum is None:
            logger.warning(f"⚠️ Неизвестный тип события для задачи: {event_type}, используем TASK_UPDATED")
            event_enum = NotificationEvent.TASK_UPDATED
        
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
            event_enum,
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


# ==================== REQUEST MODELS ====================

class ProjectNotificationRequest(BaseModel):
    event_type: str  # user_added, user_removed, updated
    project_id: int
    project_name: str
    description: str = None
    changes: str = None
    user_ids: list = None


class GroupNotificationRequest(BaseModel):
    event_type: str  # user_added, user_removed, created, deleted, updated
    project_id: int
    project_name: str
    group_id: int
    group_name: str
    description: str = None
    user_ids: list = None


class TaskNotificationRequest(BaseModel):
    event_type: str  # created, deleted, updated, assigned, overdue
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


# ==================== FastAPI ENDPOINTS ====================

app = FastAPI(title="Kanban Telegram Bot API")


@app.get("/api/health")
async def health_check():
    """Проверка здоровья API"""
    logger.info("🏥 Health check запрос")
    is_ok = check_initialized()
    status = "ok" if is_ok else "initializing"
    return {
        "status": status,
        "message": "Telegram Bot API is running",
        "initialized": is_ok
    }


@app.post("/api/notify/project")
async def notify_project(request: ProjectNotificationRequest):
    """Отправить уведомление о проекте"""
    try:
        logger.info(f"📋 Получен запрос на уведомление о проекте: {request.project_name} (event_type={request.event_type})")
        
        if not check_initialized():
            logger.error("❌ API не полностью инициализирован!")
            raise HTTPException(status_code=503, detail="API not initialized yet. Please retry.")
        
        api = NotificationAPI(_db, _bot)
        await api.send_project_notification(
            request.event_type,
            request.project_id,
            request.project_name,
            request.description,
            request.changes,
            request.user_ids
        )
        
        logger.info("✅ Уведомление о проекте обработано успешно")
        return {"status": "ok", "message": "Project notification sent"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомления о проекте: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify/group")
async def notify_group(request: GroupNotificationRequest):
    """Отправить уведомление о группе"""
    try:
        logger.info(f"👥 Получен запрос на уведомление о группе: {request.group_name} (event_type={request.event_type})")
        
        if not check_initialized():
            logger.error("❌ API не полностью инициализирован!")
            raise HTTPException(status_code=503, detail="API not initialized yet. Please retry.")
        
        api = NotificationAPI(_db, _bot)
        await api.send_group_notification(
            request.event_type,
            request.project_id,
            request.project_name,
            request.group_id,
            request.group_name,
            request.description,
            request.user_ids
        )
        
        logger.info("✅ Уведомление о группе обработано успешно")
        return {"status": "ok", "message": "Group notification sent"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомления о группе: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notify/task")
async def notify_task(request: TaskNotificationRequest):
    """Отправить уведомление о задаче"""
    try:
        logger.info(f"✅ Получен запрос на уведомление о задаче: {request.title} (event_type={request.event_type})")
        
        if not check_initialized():
            logger.error("❌ API не полностью инициализирован!")
            raise HTTPException(status_code=503, detail="API not initialized yet. Please retry.")
        
        api = NotificationAPI(_db, _bot)
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
        
        logger.info("✅ Уведомление о задаче обработано успешно")
        return {"status": "ok", "message": "Task notification sent"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка при отправке уведомления о задаче: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint"""
    is_ok = check_initialized()
    return {
        "service": "Kanban Telegram Bot API",
        "version": "1.0",
        "status": "ready" if is_ok else "initializing",
        "endpoints": {
            "health": "/api/health",
            "notify_project": "/api/notify/project",
            "notify_group": "/api/notify/group",
            "notify_task": "/api/notify/task"
        }
    }
