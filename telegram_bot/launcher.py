#!/usr/bin/env python3
"""
Launcher который запускает FastAPI через api_server и Telegram Bot
FastAPI будет инициализирован в api_server модуле
"""
import subprocess
import sys
import time
import os

if __name__ == "__main__":
    os.chdir("/app/telegram_bot")
    
    # Запустить FastAPI через api_server.py (который инициализирует API)
    print("📡 Запуск FastAPI на порту 8000 с инициализацией API...")
    api_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd="/app/telegram_bot"
    )
    
    # Подождать пока API запустится
    time.sleep(2)
    
    # Запустить Telegram бота
    print("🤖 Запуск Telegram бота...")
    print("")
    
    bot_proc = subprocess.Popen(
        [sys.executable, "main.py"],
        cwd="/app/telegram_bot"
    )
    
    # Жди завершения любого из процессов
    try:
        while True:
            api_status = api_proc.poll()
            bot_status = bot_proc.poll()
            
            if api_status is not None:
                print(f"⚠️ API process exited with code {api_status}")
                bot_proc.terminate()
                break
            
            if bot_status is not None:
                print(f"⚠️ Bot process exited with code {bot_status}")
                api_proc.terminate()
                break
            
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        api_proc.terminate()
        bot_proc.terminate()
        try:
            api_proc.wait(timeout=5)
            bot_proc.wait(timeout=5)
        except:
            api_proc.kill()
            bot_proc.kill()
