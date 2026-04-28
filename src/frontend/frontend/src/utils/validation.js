export const validateFullName = (name) => {
    const trimmed = name?.trim();
    if (!trimmed) {
        return { isValid: false, error: 'Имя обязательно' };
    }
    const words = trimmed.split(/\s+/);
    if (words.length !== 2) {
        return { isValid: false, error: 'Введите имя и фамилию (два слова)' };
    }
    const cyrillicWordRegex = /^[А-ЯЁ][а-яё]+$/;
    for (const word of words) {
        if (!cyrillicWordRegex.test(word)) {
            return { isValid: false, error: `"${word}" должно начинаться с заглавной буквы и содержать только кириллицу` };
        }
    }
    return { isValid: true, error: '' };
};


export const validatePassword = (password) => {
    if (!password) {
        return { isValid: false, error: 'Пароль обязателен' };
    }
    const allowedSpecial = '!"#$%&\'()*+,-./:;<=>?@[]^_';
    const regex = new RegExp(`^[A-Za-z0-9${allowedSpecial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+$`);
    if (!regex.test(password)) {
        return { isValid: false, error: 'Пароль может содержать только латинские буквы, цифры и спецсимволы: !"#$%&\'()*+,-./:;<=>?@[]^_' };
    }
    if (password.length < 6) {
        return { isValid: false, error: 'Пароль должен содержать минимум 6 символов' };
    }
    return { isValid: true, error: '' };
};