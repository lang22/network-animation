import React from 'react';
import { Provider } from 'react-redux';
import { act, renderHook } from '@testing-library/react';
import { store } from '@/store';
import {
  reset,
  setDropNextSeq,
  setLossRate,
  setPacketLossEnabled,
} from '@/store/slices/congestionSlice';
import { useCongestionControl } from '@/hooks/useCongestionControl';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

const renderControl = () => renderHook(() => useCongestionControl(3), { wrapper });

const congestion = () => store.getState().congestion;

/** 分片推进假时钟，让每个 await 之后的续体有机会安排新的定时器 */
const advance = async (ms: number, step = 50) => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => { jest.advanceTimersByTime(step); });
  }
};

const forceLossOnFirstPacket = () => {
  store.dispatch(setPacketLossEnabled(true));
  store.dispatch(setLossRate(0));
  store.dispatch(setDropNextSeq(1));
};

beforeEach(() => {
  jest.useFakeTimers();
  store.dispatch(reset());
  // 用定时器模拟 rAF，让动画随假时钟推进
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback =>
    window.setTimeout(() => callback(performance.now()), 16),
  );
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useCongestionControl 丢包与重传', () => {
  it('指定丢包后在链路中途判定丢失，RTO 超时后重传一次', async () => {
    const { result } = renderControl();

    act(() => { forceLossOnFirstPacket(); });

    let demo: Promise<void> | undefined;
    act(() => { demo = result.current.performSlowStart(); });

    // 第 1 个包：飞到 55% 处丢包 -> RTO 超时 -> 重传 -> ACK
    await advance(4000);

    expect(congestion().lostPackets).toBe(1);
    expect(congestion().timeoutCount).toBe(1);
    expect(congestion().retransmissionCount).toBe(1);
    expect(congestion().window.cwnd).toBe(1);

    act(() => { result.current.resetAll(); });
    await act(async () => { await demo; });
  });

  it('重传同样会丢，连续 3 次失败后放弃该包', async () => {
    const { result } = renderControl();

    act(() => {
      store.dispatch(setPacketLossEnabled(true));
      store.dispatch(setLossRate(1));
    });

    let demo: Promise<void> | undefined;
    act(() => { demo = result.current.performSlowStart(); });

    await advance(8000);

    const state = congestion();
    expect(state.lostPackets).toBeGreaterThanOrEqual(3);
    expect(state.timeoutCount).toBeGreaterThanOrEqual(3);
    expect(state.retransmissionCount).toBeGreaterThanOrEqual(2);
    expect(state.eventLog.some(e => e.text.includes('放弃重传'))).toBe(true);

    act(() => { result.current.resetAll(); });
    await act(async () => { await demo; });
  });

  it('终止演示会取消等待中的 RTO，且不会自行恢复', async () => {
    const { result } = renderControl();

    act(() => { forceLossOnFirstPacket(); });

    let demo: Promise<void> | undefined;
    act(() => { demo = result.current.performFullDemo(); });

    await advance(1500);
    expect(congestion().rttCount).toBeGreaterThan(0);
    expect(congestion().isPlaying).toBe(true);
    expect(congestion().flightBalls.length).toBeGreaterThan(0);

    act(() => { result.current.resetAll(); });
    await act(async () => { await demo; });

    expect(congestion().isPlaying).toBe(false);
    expect(congestion().flightBalls).toHaveLength(0);
    expect(congestion().rttCount).toBe(0);

    // 再推进很久，演示不应从旧循环里“复活”
    await advance(20000, 200);

    expect(congestion().rttCount).toBe(0);
    expect(congestion().flightBalls).toHaveLength(0);
    expect(congestion().isPlaying).toBe(false);
  });
});
