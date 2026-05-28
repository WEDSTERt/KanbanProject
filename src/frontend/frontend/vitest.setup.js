// Mock localStorage для тестов
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  },
};

// Mock EventSource
global.EventSource = class {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.listeners = {};
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }
  }

  close() {
    this.readyState = 2;
  }
};

// Mock fetch для токена
global.fetch = () =>
  Promise.resolve({
    json: () => Promise.resolve({ token: 'test-token-123' }),
  });
