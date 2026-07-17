import {
  MAX_DIAGNOSTIC_LOG_BYTES,
  PersistentDiagnosticLog,
  createPlayerDiagnosticLogPaths,
  createPlayerDiagnosticSink,
  prunePlayerDiagnosticLogs,
} from './diagnostic-log';
import { IinaHttpTransport } from './iina-http';
import { createOpaqueId } from './ids';
import { PlayerRuntime } from './player-runtime';
import { SafeLogger } from './safe-logger';

const api = iina;
const diagnosticPaths = createPlayerDiagnosticLogPaths(createOpaqueId('player'));
const diagnostics = new PersistentDiagnosticLog(
  api.file,
  () => undefined,
  Date.now,
  MAX_DIAGNOSTIC_LOG_BYTES,
  diagnosticPaths,
);
const logger = new SafeLogger(
  createPlayerDiagnosticSink(api.console, (record) => {
    diagnostics.append(record.level, 'player', record.message);
  }),
);

const runtime = new PlayerRuntime(api, new IinaHttpTransport(api.http), logger);
runtime.install();
logger.info('Jellyfin player integration ready');
prunePlayerDiagnosticLogs(api.file, diagnosticPaths.generationId);
