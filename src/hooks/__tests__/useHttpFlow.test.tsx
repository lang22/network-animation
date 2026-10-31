import { act, renderHook } from '@testing-library/react';
import { useHttpFlow } from '@/hooks/useHttpFlow';

/** 用定时器模拟 rAF，让动画随假时钟推进 */
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const advance = async (ms: number, step = 20) => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => { jest.advanceTimersByTime(step); });
  }
};

describe('useHttpFlow', () => {
  it('runs request → processing → response → done', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send('GET', '/index.html'); });
    expect(result.current.phase).toBe('request');

    let sawProcessing = false;
    let sawResponse = false;
    for (let i = 0; i < 60; i += 1) {
      await act(async () => { jest.advanceTimersByTime(20); });
      if (result.current.phase === 'processing') sawProcessing = true;
      if (result.current.phase === 'response') sawResponse = true;
    }

    expect(sawProcessing).toBe(true);
    expect(sawResponse).toBe(true);
    expect(result.current.phase).toBe('done');
    expect(result.current.response?.startLine).toBe('HTTP/1.1 200 OK');
    expect(result.current.request?.startLine).toBe('GET /index.html HTTP/1.1');
    expect(result.current.log.length).toBeGreaterThanOrEqual(4);
    expect(result.current.isSending).toBe(false);
  });

  it('ignores a second send while one is running', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send('GET', '/a'); });
    act(() => { void result.current.send('GET', '/b'); });

    expect(result.current.request?.startLine).toBe('GET /a HTTP/1.1');
  });

  it('reset clears the exchange', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send('POST', '/login'); });
    await advance(100);
    act(() => { result.current.reset(); });

    expect(result.current.phase).toBe('idle');
    expect(result.current.request).toBeNull();
    expect(result.current.response).toBeNull();
    expect(result.current.progress).toBe(0);
  });
});
