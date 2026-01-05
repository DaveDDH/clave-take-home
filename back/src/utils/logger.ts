// Centralized logging utility with process ID grouping

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: unknown;
}

interface ProcessLogs {
  processId: string;
  logs: LogEntry[];
}

// In-memory storage of logs grouped by process ID
const processLogs = new Map<string, LogEntry[]>();

function createLogEntry(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  data?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
}

function formatLogForConsole(entry: LogEntry, processId?: string): string {
  const prefix = processId ? `[${processId.slice(0, 8)}]` : "";
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
  const level = entry.level.toUpperCase().padEnd(5);
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${timestamp} ${prefix} ${level} ${entry.message}${dataStr}`;
}

export function log(
  message: string,
  data?: unknown,
  processId?: string
): void {
  const entry = createLogEntry("info", message, data);

  // Always log to console
  console.log(formatLogForConsole(entry, processId));

  // Store in memory if processId provided
  if (processId) {
    if (!processLogs.has(processId)) {
      processLogs.set(processId, []);
    }
    processLogs.get(processId)!.push(entry);
  }
}

export function logError(
  message: string,
  data?: unknown,
  processId?: string
): void {
  const entry = createLogEntry("error", message, data);

  // Always log to console
  console.error(formatLogForConsole(entry, processId));

  // Store in memory if processId provided
  if (processId) {
    if (!processLogs.has(processId)) {
      processLogs.set(processId, []);
    }
    processLogs.get(processId)!.push(entry);
  }
}

export function logWarn(
  message: string,
  data?: unknown,
  processId?: string
): void {
  const entry = createLogEntry("warn", message, data);

  // Always log to console
  console.warn(formatLogForConsole(entry, processId));

  // Store in memory if processId provided
  if (processId) {
    if (!processLogs.has(processId)) {
      processLogs.set(processId, []);
    }
    processLogs.get(processId)!.push(entry);
  }
}

export function logDebug(
  message: string,
  data?: unknown,
  processId?: string
): void {
  const entry = createLogEntry("debug", message, data);

  // Always log to console
  console.debug(formatLogForConsole(entry, processId));

  // Store in memory if processId provided
  if (processId) {
    if (!processLogs.has(processId)) {
      processLogs.set(processId, []);
    }
    processLogs.get(processId)!.push(entry);
  }
}

export function getProcessLogs(processId: string): LogEntry[] {
  return processLogs.get(processId) || [];
}

export function clearProcessLogs(processId: string): void {
  processLogs.delete(processId);
}

export function getAllProcessLogs(): ProcessLogs[] {
  return Array.from(processLogs.entries()).map(([processId, logs]) => ({
    processId,
    logs,
  }));
}

// Helper for formatting logs as strings (for API responses)
export function formatLogsAsString(logs: LogEntry[]): string {
  return logs.map((entry) => formatLogForConsole(entry)).join("\n");
}
