#!/usr/bin/env python3
"""
main.py с инициализацией API
Вставить эти строки в main() перед "Запуск фоновых задач":

        # Инициализировать API с глобальными переменными
        logger.info("🔧 Инициализация API...")
        try:
            from api import set_api_instances
            from notifications import NotificationManager
            notification_manager = NotificationManager(db, bot)
            set_api_instances(db, bot, notification_manager)
            logger.info("✅ API полностью инициализирован и готов принимать запросы")
        except Exception as e:
            logger.error(f"⚠️ Ошибка при инициализации API: {e}", exc_info=True)
"""
pass
