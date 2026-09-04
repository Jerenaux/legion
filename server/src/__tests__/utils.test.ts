import { withRetry } from '../utils';

describe('utils', () => {
  describe('withRetry', () => {
    it('should execute function successfully on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(mockFn, 3, 100, 'testOperation');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await withRetry(mockFn, 5, 50, 'testOperation');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(
        withRetry(mockFn, 3, 50, 'testOperation')
      ).rejects.toThrow('Always fails');
      
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should wait specified delay between retries', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await withRetry(mockFn, 3, 100, 'testOperation');
      const endTime = Date.now();
      
      // Should have waited at least 100ms for one retry
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should use default parameters when not provided', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle async functions correctly', async () => {
      const mockFn = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async success';
      });
      
      const result = await withRetry(mockFn, 3, 50, 'testOperation');
      
      expect(result).toBe('async success');
    });
  });
});
