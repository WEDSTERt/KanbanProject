"""
OAuth webhook handler - получает сообщения от backend когда OAuth успешен
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class OAuthWebhookHandler:
    """Обработчик webhook'ов от backend при успешной OAuth авторизации"""

    def __init__(self, db, bot):
        self.db = db
        self.bot = bot

    async def handle_oauth_callback(self, user_id: int, telegram_id: int, provider: str) -> bool:
        """
        Обработка успешной OAuth авторизации
        
        Args:
            user_id: ID пользователя в системе
            telegram_id: Telegram chat ID
            provider: Провайдер (google, yandex, github)
            
        Returns:
            True если успешно обработано
        """
        try:
            logger.info(f"📨 Получен callback OAuth от backend: user_id={user_id}, telegram_id={telegram_id}, provider={provider}")
            
            # Обновляем БД локально
            self.db.execute(
                """
                UPDATE telegram_users 
                SET user_id = %s, oauth_provider = %s, oauth_completed_at = NOW()
                WHERE telegram_id = %s
                """,
                (user_id, provider, telegram_id)
            )
            
            # Отправляем сообщение боту
            message = (
                f"✅ <b>Успешная авторизация!</b>\n\n"
                f"Вы успешно вошли через {provider.upper()}.\n"
                f"Ваш аккаунт привязан к Telegram.\n\n"
                f"Теперь вы можете получать уведомления о проектах и задачах!"
            )
            
            await self.bot.send_message(
                telegram_id,
                message,
                parse_mode="HTML"
            )
            
            logger.info(f"✅ OAuth callback обработан успешно для пользователя {telegram_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при обработке OAuth callback: {e}", exc_info=True)
            return False

    async def notify_oauth_success(self, telegram_id: int) -> bool:
        """
        Отправить сообщение об успешной авторизации
        
        Args:
            telegram_id: Telegram chat ID
            
        Returns:
            True если успешно отправлено
        """
        try:
            # Получаем информацию о пользователе
            result = self.db.fetch_one(
                """
                SELECT tu.user_id, tu.oauth_provider, tu.oauth_completed_at
                FROM telegram_users tu
                WHERE tu.telegram_id = %s
                """,
                (telegram_id,)
            )
            
            if not result or not result['user_id']:
                logger.warn(f"❌ Пользователь не найден или не авторизован: {telegram_id}")
                return False
            
            user_id = result['user_id']
            provider = result['oauth_provider'] or 'unknown'
            
            logger.info(f"📢 Отправляем сообщение об авторизации для {telegram_id} (user_id={user_id})")
            
            message = (
                f"✅ <b>Авторизация успешна!</b>\n\n"
                f"Провайдер: {provider}\n"
                f"Статус: Активен\n\n"
                f"Используйте меню для управления уведомлениями."
            )
            
            await self.bot.send_message(
                telegram_id,
                message,
                parse_mode="HTML"
            )
            
            logger.info(f"✅ Сообщение об авторизации отправлено")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об авторизации: {e}", exc_info=True)
            return False

    async def send_oauth_link_expired_message(self, telegram_id: int) -> bool:
        """
        Отправить сообщение об истечении времени на OAuth
        
        Args:
            telegram_id: Telegram chat ID
            
        Returns:
            True если успешно отправлено
        """
        try:
            message = (
                f"⏱️ <b>Время авторизации истекло</b>\n\n"
                f"Ссылка действительна 10 минут.\n"
                f"Используйте /start и попробуйте снова."
            )
            
            await self.bot.send_message(
                telegram_id,
                message,
                parse_mode="HTML"
            )
            
            logger.info(f"✅ Сообщение об истечении времени отправлено")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при отправке сообщения об истечении времени: {e}", exc_info=True)
            return False
