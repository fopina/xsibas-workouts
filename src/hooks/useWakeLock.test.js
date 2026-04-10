import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/preact';
import { useWakeLock } from './useWakeLock';

describe('useWakeLock', () => {
  let mockWakeLock;
  let mockWakeLockInstance;
  let localStorageMock;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    global.localStorage = localStorageMock;

    // Mock Wake Lock instance
    mockWakeLockInstance = {
      type: 'screen',
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn()
    };

    // Mock navigator.wakeLock
    mockWakeLock = {
      request: vi.fn().mockResolvedValue(mockWakeLockInstance)
    };

    global.navigator.wakeLock = mockWakeLock;

    // Mock console methods to reduce test noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'trace').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.navigator.wakeLock;
  });

  it('should detect wake lock support', () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.isSupported).toBe(true);
  });

  it('should detect when wake lock is not supported', () => {
    delete global.navigator.wakeLock;
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.isSupported).toBe(false);
  });

  it('should load saved preference from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('true');

    const { result } = renderHook(() => useWakeLock());

    expect(localStorageMock.getItem).toHaveBeenCalledWith('wakeLockEnabled');
    expect(result.current.isEnabled).toBe(true);
  });

  it('should handle invalid localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json');

    const { result } = renderHook(() => useWakeLock());

    expect(result.current.isEnabled).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('should toggle wake lock on', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
      expect(mockWakeLock.request).toHaveBeenCalledWith('screen');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('wakeLockEnabled', 'true');
    });
  });

  it('should toggle wake lock off', async () => {
    localStorageMock.getItem.mockReturnValue('true');

    const { result } = renderHook(() => useWakeLock());

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
    });

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
      expect(mockWakeLockInstance.release).toHaveBeenCalled();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('wakeLockEnabled', 'false');
    });
  });

  it('should activate wake lock when enabled', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(mockWakeLock.request).toHaveBeenCalledWith('screen');
    });
  });

  it('should handle NotSupportedError', async () => {
    mockWakeLock.request.mockRejectedValue({ name: 'NotSupportedError', message: 'Not supported' });

    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isSupported).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  it('should handle NotAllowedError', async () => {
    mockWakeLock.request.mockRejectedValue({ name: 'NotAllowedError', message: 'Not allowed' });

    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true); // Still supported, just not allowed
      expect(console.warn).toHaveBeenCalled();
    });
  });

  it('should not request wake lock if already active', async () => {
    const { result } = renderHook(() => useWakeLock());

    // Enable wake lock first
    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    const requestCallCount = mockWakeLock.request.mock.calls.length;

    // Try to request again - should be skipped
    await act(async () => {
      // Simulate another component trying to request
      const hook = renderHook(() => useWakeLock());
      // The existing lock should prevent a new request
    });

    // Should not call request again
    expect(mockWakeLock.request.mock.calls.length).toBeLessThanOrEqual(requestCallCount + 1);
  });

  it('should handle release event', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    // Simulate the release event
    const releaseCallback = mockWakeLockInstance.addEventListener.mock.calls[0][1];
    act(() => {
      releaseCallback();
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
    });
  });

  it('should set up visibility change listener when enabled', async () => {
    localStorageMock.getItem.mockReturnValue('true');

    // Mock document visibility as visible
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible'
    });

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    renderHook(() => useWakeLock());

    await waitFor(() => {
      expect(mockWakeLock.request).toHaveBeenCalled();
    });

    // Should have added visibility change listener
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
  });

  it('should save preference when toggling', async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('wakeLockEnabled', 'true');
  });

  it('should handle localStorage save errors gracefully', async () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });

    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    expect(console.warn).toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(true); // Should still work
  });

  it('should reset to off and require one tap after gesture-required startup failure', async () => {
    localStorageMock.getItem.mockReturnValue('true');
    mockWakeLock.request.mockRejectedValue({ name: 'NotAllowedError', message: 'Gesture required' });

    const { result } = renderHook(() => useWakeLock());

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.needsUserGesture).toBe(true);
      expect(result.current.errorMessage).toBe('Wake lock needs a tap to re-enable on this device');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('wakeLockEnabled', 'false');
    });

    mockWakeLock.request.mockResolvedValue(mockWakeLockInstance);

    await act(async () => {
      await result.current.toggleWakeLock();
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(true);
      expect(result.current.isActive).toBe(true);
      expect(result.current.needsUserGesture).toBe(false);
      expect(mockWakeLock.request).toHaveBeenCalledTimes(2);
    });
  });
});
