/**
 * Проверка имени пользователя (кириллица, два слова, первые буквы заглавные)
 * @param {string} name - полное имя
 * @returns {object} { isValid: boolean, error: string }
 */
export const validateFullName = (name) => {
    const trimmed = name?.trim();
    if (!trimmed) {
        return { isValid: false, error: 'Имя обязательно' };
    }
    // Разделяем на слова (по пробелам)
    const words = trimmed.split(/\s+/);
    if (words.length !== 2) {
        return { isValid: false, error: 'Введите имя и фамилию (два слова)' };
    }
    // Проверка каждого слова: первая буква заглавная кириллица, остальные строчные кириллица
    const cyrillicWordRegex = /^[А-ЯЁ][а-яё]+$/;
    for (const word of words) {
        if (!cyrillicWordRegex.test(word)) {
            return { isValid: false, error: `"${word}" должно начинаться с заглавной буквы и содержать только кириллицу` };
        }
    }
    return { isValid: true, error: '' };
};

/**
 * Проверка пароля (латиница, цифры, спецсимволы !"#$%&'()*+,-./:;<=>?@[]^_)
 * @param {string} password
 * @returns {object} { isValid: boolean, error: string }
 */
export const validatePassword = (password) => {
    if (!password) {
        return { isValid: false, error: 'Пароль обязателен' };
    }
    // Разрешённые символы: a-z A-Z 0-9 и спецсимволы из списка
    const allowedSpecial = '!"#$%&\'()*+,-./:;<=>?@[]^_';
    const regex = new RegExp(`^[A-Za-z0-9${allowedSpecial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`);
    if (!regex.test(password)) {
        return { isValid: false, error: 'Пароль может содержать только латинские буквы, цифры и спецсимволы: !"#$%&\'()*+,-./:;<=>?@[]^_' };
    }
    // Минимальная длина 6 символов (можно настроить)
    if (password.length < 6) {
        return { isValid: false, error: 'Пароль должен содержать минимум 6 символов' };
    }
    return { isValid: true, error: '' };
};