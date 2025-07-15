/**
 * Rate limiter for API calls
 * Implements a concurrency limiter to restrict the number of concurrent requests
 */
import { config } from '../config';

class RateLimiter {
  private queue: Array<() => void> = [];
  private runningCount: number = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = config.AI_API_RATE_LIMIT) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Executes a function with rate limiting
   * @param fn - The function to execute
   * @returns Promise that resolves with the result of the function
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot to become available
    await this.waitForSlot();
    
    try {
      // Execute the function
      return await fn();
    } finally {
      // Release the slot
      this.releaseSlot();
    }
  }

  /**
   * Waits for a slot to become available
   * @returns Promise that resolves when a slot is available
   */
  private waitForSlot(): Promise<void> {
    // If we haven't reached the concurrency limit, proceed immediately
    if (this.runningCount < this.maxConcurrent) {
      this.runningCount++;
      return Promise.resolve();
    }

    // Otherwise, add to the queue and wait
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Releases a slot and processes the next item in the queue if any
   */
  private releaseSlot(): void {
    // If there are items in the queue, process the next one
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    } else {
      // Otherwise, decrement the running count
      this.runningCount--;
    }
  }
}

// Export a singleton instance
export const rateLimiter = new RateLimiter();