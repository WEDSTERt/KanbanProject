// Утилиты для работы с задачами

export const normalizeStatus = (status) => {
    if (typeof status === 'number') {
        if (status === 0) return 'TODO';
        if (status === 1) return 'IN_PROGRESS';
        if (status === 2) return 'REVIEW';
        return 'TODO';
    }
    const upper = String(status).toUpperCase();
    if (upper === 'INPROGRESS') return 'IN_PROGRESS';
    if (['TODO', 'IN_PROGRESS', 'REVIEW'].includes(upper)) return upper;
    return 'TODO';
};

export const getTaskDueDateColor = (task) => {
    const status = normalizeStatus(task.status);
    if (status === 'REVIEW') return null;
    if (!task.dueDate) return null;
    const now = new Date();
    const due = new Date(task.dueDate);
    const hoursLeft = (due - now) / (1000 * 60 * 60);
    if (hoursLeft < 0) return '#dc2626';
    if (hoursLeft < 24) return '#f59e0b';
    if (hoursLeft < 72) return '#eab308';
    return null;
};

export const getDueWarningText = (task) => {
    const status = normalizeStatus(task.status);
    if (status === 'REVIEW') return null;
    if (!task.dueDate) return null;
    const now = new Date();
    const due = new Date(task.dueDate);
    const hoursLeft = (due - now) / (1000 * 60 * 60);
    if (hoursLeft < 0) return 'Просрочено';
    if (hoursLeft < 24) return 'Менее суток';
    if (hoursLeft < 72) return 'Менее 3 дней';
    return null;
};

export const getTaskCardStyle = (task, isSubTask = false) => {
    const dueDateColor = getTaskDueDateColor(task);
    const baseStyle = { borderLeftColor: dueDateColor || '#2563eb' };
    if (isSubTask) {
        return {
            ...baseStyle,
            padding: '6px 8px',
            fontSize: '0.75rem',
            marginLeft: '16px',
            backgroundColor: dueDateColor ? `${dueDateColor}08` : '#fafbfc',
        };
    }
    if (dueDateColor) {
        return { ...baseStyle, backgroundColor: `${dueDateColor}08` };
    }
    return baseStyle;
};

export const transliterateTitle = (title) => {
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
        'я': 'ya', 'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
        'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H',
        'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E',
        'Ю': 'Yu', 'Я': 'Ya'
    };
    return title
        .split('')
        .map(char => translitMap[char] || char)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50);
};
