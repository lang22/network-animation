import { act, renderHook } from '@testing-library/react';
import { useStepFlow } from '@/hooks/useStepFlow';
import { buildDhcpExchange } from '@/services/protocols/dhcpService';

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

describe('useStepFlow', () => {
  it('依次播放所有步骤并结束', async () => {
    const steps = buildDhcpExchange();
    const { result } = renderHook(() => useStepFlow(10));

    act(() => { void result.current.play(steps); });
    expect(result.current.status).toBe('playing');

    for (let i = 0; i < 80 && result.current.status !== 'done'; i += 1) {
      await act(async () => { jest.advanceTimersByTime(20); });
    }

    expect(result.current.status).toBe('done');
    expect(result.current.log).toHaveLength(steps.length);
    expect(result.current.packet).toBeNull();
    expect(result.current.currentIndex).toBe(steps.length - 1);
    expect(result.current.log[0].text).toContain('Discover');
  });

  it('播放中重置会停下并清空日志', async () => {
    const { result } = renderHook(() => useStepFlow(10));

    act(() => { void result.current.play(buildDhcpExchange()); });
    await advance(120);

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.packet).toBeNull();
    expect(result.current.log).toHaveLength(0);

    await advance(500);
    expect(result.current.status).toBe('idle');
  });

  it('播放中忽略重复调用', async () => {
    const { result } = renderHook(() => useStepFlow(10));
    const steps = buildDhcpExchange();

    act(() => { void result.current.play(steps); });
    await advance(100);
    const indexBefore = result.current.currentIndex;

    act(() => { void result.current.play(steps); });
    expect(result.current.currentIndex).toBe(indexBefore);
  });
});
