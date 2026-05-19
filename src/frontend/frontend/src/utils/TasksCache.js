class TasksCache {
    constructor(ttl = 60000) { // 1 минута по умолчанию
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.ttl) {
            return item.data;
        }
        if (item) {
            this.cache.delete(key);
        }
        return null;
    }

    has(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.ttl) {
            return true;
        }
        if (item) {
            this.cache.delete(key);
        }
        return false;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

export const tasksCache = new TasksCache(30000); // 30 секунд
export const subTasksCache = new TasksCache(60000); // 1 минута