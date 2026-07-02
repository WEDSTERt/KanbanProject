import sys

# Читаем исходный main.py
with open(r'C:\MARAT\chatbotkanban\Users\Marat\IdeaProjects\ProjectKanban\telegram_bot\main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Ищем строку для вставки - "⏰ Запуск фоновых задач"
insert_index = -1
for i, line in enumerate(lines):
    if '⏰ Запуск фоновых задач' in line:
        insert_index = i
        break

if insert_index > 0:
    # Вставляем инициализацию API ПЕРЕД этой строкой
    api_init = '''        # 🔧 ИНИЦИАЛИЗИРОВАТЬ API С ГЛОБАЛЬНЫМИ ПЕРЕМЕННЫМИ
        logger.info("🔧 Инициализация API с глобальными переменными...")
        try:
            from api import set_api_instances
            from notifications import NotificationManager
            notification_manager = NotificationManager(db, bot)
            set_api_instances(db, bot, notification_manager)
            logger.info("✅ API полностью инициализирован и готов принимать запросы")
        except Exception as e:
            logger.error(f"⚠️ Ошибка при инициализации API: {e}", exc_info=True)
        
'''
    lines.insert(insert_index, api_init)
    
    # Пишем обновленный файл
    with open(r'C:\MARAT\chatbotkanban\Users\Marat\IdeaProjects\ProjectKanban\telegram_bot\main.py', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("OK - main.py updated")
else:
    print("ERROR - string not found")
    sys.exit(1)
