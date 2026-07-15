import { IinaHttpTransport } from './iina-http';
import { PlayerRuntime } from './player-runtime';
import { SafeLogger } from './safe-logger';

const api = iina;
const logger = new SafeLogger({
  log: (message) => api.console.log(message),
  warn: (message) => api.console.warn(message),
  error: (message) => api.console.error(message),
});

const runtime = new PlayerRuntime(api, new IinaHttpTransport(api.http), logger);
runtime.install();
logger.info('Jellyfin player integration ready');
