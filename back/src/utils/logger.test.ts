import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  log,
  logError,
  logWarn,
  logDebug,
  getProcessLogs,
  clearProcessLogs,
  getAllProcessLogs,
  formatLogsAsString,
} from './logger.js';

describe('logger', () => {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleDebug = console.debug;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.debug = originalConsoleDebug;
    // Clear any test process logs
    clearProcessLogs('test-process-1');
    clearProcessLogs('test-process-2');
  });

  describe('log', () => {
    it('logs message to console', () => {
      log('Test message');
      expect(console.log).toHaveBeenCalled();
    });

    it('logs message with data', () => {
      log('Test message', { key: 'value' });
      expect(console.log).toHaveBeenCalled();
      const call = (console.log as jest.Mock).mock.calls[0][0];
      expect(call).toContain('Test message');
      expect(call).toContain('"key":"value"');
    });

    it('stores log when processId is provided', () => {
      log('Test message', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].level).toBe('info');
    });

    it('does not store log when processId is not provided', () => {
      log('Test message');
      const logs = getProcessLogs('nonexistent');
      expect(logs).toHaveLength(0);
    });
  });

  describe('logError', () => {
    it('logs error to console.error', () => {
      logError('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('stores error log with processId', () => {
      logError('Error message', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
    });
  });

  describe('logWarn', () => {
    it('logs warning to console.warn', () => {
      logWarn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('stores warning log with processId', () => {
      logWarn('Warning message', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
    });
  });

  describe('logDebug', () => {
    it('logs debug to console.debug', () => {
      logDebug('Debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('stores debug log with processId', () => {
      logDebug('Debug message', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('debug');
    });
  });

  describe('getProcessLogs', () => {
    it('returns empty array for unknown processId', () => {
      const logs = getProcessLogs('unknown');
      expect(logs).toEqual([]);
    });

    it('returns all logs for a process', () => {
      log('Message 1', undefined, 'test-process-1');
      logError('Message 2', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      expect(logs).toHaveLength(2);
    });
  });

  describe('clearProcessLogs', () => {
    it('clears logs for a specific process', () => {
      log('Message', undefined, 'test-process-1');
      expect(getProcessLogs('test-process-1')).toHaveLength(1);
      clearProcessLogs('test-process-1');
      expect(getProcessLogs('test-process-1')).toHaveLength(0);
    });
  });

  describe('getAllProcessLogs', () => {
    it('returns all process logs', () => {
      log('Message 1', undefined, 'test-process-1');
      log('Message 2', undefined, 'test-process-2');
      const allLogs = getAllProcessLogs();
      const processIds = allLogs.map((p) => p.processId);
      expect(processIds).toContain('test-process-1');
      expect(processIds).toContain('test-process-2');
    });
  });

  describe('formatLogsAsString', () => {
    it('formats logs as string', () => {
      log('Test message', undefined, 'test-process-1');
      const logs = getProcessLogs('test-process-1');
      const formatted = formatLogsAsString(logs);
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('INFO');
    });

    it('returns empty string for empty logs', () => {
      const formatted = formatLogsAsString([]);
      expect(formatted).toBe('');
    });
  });
});
