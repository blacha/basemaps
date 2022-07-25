export class SwappingLru<T extends { size: number }> {
  cacheA: Map<string, T> = new Map();
  cacheB: Map<string, T> = new Map();
  maxSize: number;

  _lastCheckedAt = -1;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(id: string): T | null {
    const cacheA = this.cacheA.get(id);
    if (cacheA) return cacheA;

    const cacheB = this.cacheB.get(id);
    if (cacheB == null) return null;
    // If a object is still useful move it into the main cache
    this.cacheA.set(id, cacheB);
    this.cacheB.delete(id);
    return cacheB;
  }

  /** Reset the cache */
  clear(): void {
    this.cacheA.clear();
    this.cacheB.clear();
  }

  set(id: string, tiff: T): void {
    this.cacheA.set(id, tiff);
    this.check();
  }

  /** Validate the size of the cache has not exploded */
  check(): void {
    this._lastCheckedAt = Date.now();
    if (this.maxSize <= 0) return;
    if (this.currentSize <= this.maxSize) return;
    this.cacheB = this.cacheA;
    this.cacheA = new Map();
  }

  /** Calculate the total number of bytes used by this cache */
  get currentSize(): number {
    let size = 0;
    for (const value of this.cacheA.values()) size += value.size;
    return size;
  }
}