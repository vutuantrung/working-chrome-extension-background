/** Chrome-independent persistence contract used by background services. */
export interface StoragePort {
  get(keys?: string[]): Promise<Record<string, any>>;
  set(values: Record<string, any>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}
