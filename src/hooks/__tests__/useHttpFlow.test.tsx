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

const runUntilDone = async (result: { current: { phase: string } }, limit = 400) => {
  for (let i = 0; i < limit && result.current.phase !== 'done'; i += 1) {
    await act(async () => { jest.advanceTimersByTime(20); });
  }
};

describe('useHttpFlow', () => {
  it('HTTP/1.1 依次加载三个资源', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ path: '/index.html', version: 'http1' }); });

    expect(result.current.phase).toBe('transfer');
    expect(result.current.streams).toHaveLength(3);
    expect(result.current.stageLabel).toContain('HTTP/1.1');

    await runUntilDone(result);

    expect(result.current.phase).toBe('done');
    expect(result.current.streams.every(stream => stream.status === 'done')).toBe(true);
    expect(Object.keys(result.current.responses)).toHaveLength(3);
    expect(result.current.log.some(entry => entry.text.includes('HTTP/1.1 串行'))).toBe(true);
  });

  it('HTTP/2 三个请求同时在飞', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ path: '/index.html', version: 'http2' }); });

    await act(async () => { jest.advanceTimersByTime(40); });

    const requestFlights = result.current.flights.filter(flight => flight.kind === 'request');
    expect(requestFlights).toHaveLength(3);
    expect(result.current.log.some(entry => entry.text.includes('HTTP/2 多路复用'))).toBe(true);

    await runUntilDone(result);
    expect(result.current.phase).toBe('done');
    expect(result.current.streams.every(stream => stream.status === 'done')).toBe(true);
  });

  it('HTTPS 先完成 TLS 握手再传输', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ secure: true }); });
    expect(result.current.phase).toBe('tls');

    const seen = new Set<string>();
    for (let i = 0; i < 400 && result.current.phase !== 'done'; i += 1) {
      await act(async () => { jest.advanceTimersByTime(20); });
      seen.add(result.current.phase);
    }

    expect(seen.has('transfer')).toBe(true);
    expect(result.current.log.some(entry => entry.text.includes('ClientHello'))).toBe(true);
    expect(result.current.log.some(entry => entry.text.includes('TLS 握手完成'))).toBe(true);
    expect(result.current.phase).toBe('done');
  });

  it('可以切换查看不同流', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ version: 'http2' }); });
    await runUntilDone(result);

    act(() => { result.current.selectStream(2); });
    expect(result.current.selectedStreamId).toBe(2);
    expect(result.current.requests[2]?.startLine).toBe('GET /style.css HTTP/1.1');
  });

  it('发送过程中忽略重复发送', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ path: '/a' }); });
    act(() => { void result.current.send({ path: '/b' }); });

    expect(result.current.streams[0].path).toBe('/a');
  });

  it('reset 清空所有状态', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({}); });
    await advance(100);
    act(() => { result.current.reset(); });

    expect(result.current.phase).toBe('idle');
    expect(result.current.streams).toHaveLength(0);
    expect(result.current.flights).toHaveLength(0);
    expect(result.current.log).toHaveLength(0);
    expect(result.current.requests).toEqual({});
  });

  it('POST 只有一条流并带请求体', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ method: 'POST', path: '/login', body: 'user=admin' }); });

    expect(result.current.streams).toHaveLength(1);
    expect(result.current.requests[1]?.body).toBe('user=admin');
  });

  it('把自定义响应头写进响应', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ responseHeaders: [['X-Cache', 'HIT']] }); });
    await runUntilDone(result);

    expect(result.current.responses[1]?.headers).toEqual(expect.arrayContaining([['X-Cache', 'HIT']]));
  });

  it('缓存校验带 If-None-Match 并拿到 304', async () => {
    const { result } = renderHook(() => useHttpFlow(10));

    act(() => { void result.current.send({ version: 'http2' }); });
    await runUntilDone(result);
    expect(result.current.phase).toBe('done');

    act(() => { void result.current.sendConditional(); });
    await runUntilDone(result);

    expect(result.current.requests[1]?.headers).toEqual(expect.arrayContaining([
      ['If-None-Match', '"6f-5e8a1c"'],
    ]));
    expect(result.current.responses[1]?.startLine).toBe('HTTP/1.1 304 Not Modified');
    expect(result.current.responses[1]?.body).toBe('');
    expect(result.current.streams[0].responseStatus).toBe(304);
    expect(result.current.log.some(entry => entry.text.includes('304'))).toBe(true);
    expect(result.current.phase).toBe('done');
  });
});
