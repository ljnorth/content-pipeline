class Logger {
  info(message, ...args) {
    console.log(`[${new Date().toISOString()}] ℹ️ ${message}`, ...args);
  }
  error(message, ...args) {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, ...args);
  }
  success(message, ...args) {
    console.log(`[${new Date().toISOString()}] ✅ ${message}`, ...args);
  }
  warn(message, ...args) {
    console.warn(`[${new Date().toISOString()}] ⚠️ ${message}`, ...args);
  }
}

export { Logger }; 