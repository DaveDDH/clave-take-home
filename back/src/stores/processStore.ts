import { ProcessedMessage } from "#ai/actions/processUserMessage/index.js";
import { randomUUID } from "crypto";
import { getProcessLogs, log, logError } from "#utils/logger.js";

export type ProcessStatus = "pending" | "processing" | "completed" | "failed";

export interface Process {
  id: string;
  status: ProcessStatus;
  result?: ProcessedMessage;
  partialResponse?: string;
  error?: string;
  logs?: string[];
  createdAt: Date;
  updatedAt: Date;
}

class ProcessStore {
  private static instance: ProcessStore;
  private processes: Map<string, Process>;

  private constructor() {
    this.processes = new Map();
  }

  public static getInstance(): ProcessStore {
    if (!ProcessStore.instance) {
      ProcessStore.instance = new ProcessStore();
    }
    return ProcessStore.instance;
  }

  public createProcess(): string {
    const id = randomUUID();
    const process: Process = {
      id,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.processes.set(id, process);
    log(`📝 Created process: ${id}`, undefined, id);
    return id;
  }

  public updateProcessStatus(id: string, status: ProcessStatus): void {
    const process = this.processes.get(id);
    if (process) {
      process.status = status;
      process.updatedAt = new Date();
      this.processes.set(id, process);
      log(`🔄 Updated process ${id} status: ${status}`, undefined, id);
    }
  }

  public setPartialResponse(id: string, partialResponse: string): void {
    const process = this.processes.get(id);
    if (process) {
      process.partialResponse = partialResponse;
      process.updatedAt = new Date();
      this.processes.set(id, process);
      log(`💬 Set partial response for process: ${id}`, undefined, id);
    }
  }

  public completeProcess(id: string, result: ProcessedMessage): void {
    const process = this.processes.get(id);
    if (process) {
      process.status = "completed";
      process.result = result;
      process.updatedAt = new Date();

      // Attach logs from this process
      const processLogs = getProcessLogs(id);
      process.logs = processLogs.map(
        (entry) => `[${entry.level.toUpperCase()}] ${entry.message}`
      );

      this.processes.set(id, process);
      log(`✅ Completed process: ${id}`, undefined, id);
    }
  }

  public failProcess(id: string, error: string): void {
    const process = this.processes.get(id);
    if (process) {
      process.status = "failed";
      process.error = error;
      process.updatedAt = new Date();

      // Attach logs from this process
      const processLogs = getProcessLogs(id);
      process.logs = processLogs.map(
        (entry) => `[${entry.level.toUpperCase()}] ${entry.message}`
      );

      this.processes.set(id, process);
      logError(`❌ Failed process: ${id}`, { error }, id);
    }
  }

  public getProcess(id: string): Process | undefined {
    return this.processes.get(id);
  }

  public deleteProcess(id: string): void {
    this.processes.delete(id);
    log(`🗑️  Deleted process: ${id}`, undefined, id);
  }

  // Clean up old processes (older than 1 hour)
  public cleanupOldProcesses(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, process] of this.processes.entries()) {
      if (process.updatedAt < oneHourAgo) {
        this.processes.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      log(`🧹 Cleaned up ${deletedCount} old process(es)`, { deletedCount });
    }
  }

  public getProcessCount(): number {
    return this.processes.size;
  }
}

export default ProcessStore.getInstance();
