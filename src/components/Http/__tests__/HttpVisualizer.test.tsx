import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import HttpVisualizer from '@/components/Http/HttpVisualizer';

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

const renderPage = () => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <HttpVisualizer />
  </MemoryRouter>,
);

const advance = async (ms: number, step = 100) => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => { jest.advanceTimersByTime(step); });
  }
};

describe('HttpVisualizer', () => {
  it('渲染控制面板与报文详情', () => {
    renderPage();

    expect(screen.getByText('HTTP 协议')).toBeInTheDocument();
    expect(screen.getByText('📄 报文详情')).toBeInTheDocument();
    expect(screen.getByText(/流（stream）/)).toBeInTheDocument();
    expect(screen.getAllByText('（尚未发送）').length).toBeGreaterThan(0);
  });

  it('点击发送后进入 HTTP/1.1 串行阶段', () => {
    renderPage();

    fireEvent.click(screen.getByText('📨 发送请求'));

    expect(screen.getAllByText(/HTTP\/1\.1 串行/).length).toBeGreaterThan(0);
  });

  it('切到 POST 后显示请求体输入', () => {
    renderPage();

    expect(screen.queryByText(/请求体/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'POST' }));
    expect(screen.getByText(/请求体/)).toBeInTheDocument();
  });

  it('选择 HTTPS 后先走 TLS 握手', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'HTTPS' }));
    fireEvent.click(screen.getByText('📨 发送请求'));
    await advance(300);

    expect(screen.getAllByText(/TLS：ClientHello/).length).toBeGreaterThan(0);
    expect(screen.getByText(/正在建立 TLS 连接/)).toBeInTheDocument();
  });

  it('选择 HTTP/2 后三个流并发', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'HTTP/2' }));
    fireEvent.click(screen.getByText('📨 发送请求'));
    await advance(200);

    expect(screen.getAllByText(/HTTP\/2 多路复用/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 · \/index\.html/)).toBeInTheDocument();
    expect(screen.getByText(/3 · \/app\.js/)).toBeInTheDocument();
  });

  it('选择 404 后响应报文显示 Not Found', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'HTTP/2' }));
    fireEvent.click(screen.getByRole('button', { name: '404' }));
    fireEvent.click(screen.getByText('📨 发送请求'));

    for (let i = 0; i < 80; i += 1) {
      await act(async () => { jest.advanceTimersByTime(100); });
      if (screen.queryAllByText(/HTTP\/1\.1 404 Not Found/).length > 0) break;
    }

    expect(screen.getAllByText(/HTTP\/1\.1 404 Not Found/).length).toBeGreaterThan(0);
  });

  it('自定义响应头会出现在响应报文里', async () => {
    renderPage();

    expect(screen.getByDisplayValue('X-Cache: HIT')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'HTTP/2' }));
    fireEvent.click(screen.getByText('📨 发送请求'));

    for (let i = 0; i < 60; i += 1) {
      await act(async () => { jest.advanceTimersByTime(100); });
      if (screen.queryAllByText(/X-Cache: HIT/).length > 0) break;
    }

    expect(screen.getAllByText(/X-Cache: HIT/).length).toBeGreaterThan(0);
  });

  it('完成后可以发起缓存校验并拿到 304', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'HTTP/2' }));
    fireEvent.click(screen.getByText('📨 发送请求'));

    const conditionalButton = screen.getByRole('button', { name: /再次请求/ }) as HTMLButtonElement;
    expect(conditionalButton.disabled).toBe(true);

    for (let i = 0; i < 90 && conditionalButton.disabled; i += 1) {
      await act(async () => { jest.advanceTimersByTime(100); });
    }
    expect(conditionalButton.disabled).toBe(false);

    fireEvent.click(conditionalButton);
    for (let i = 0; i < 60; i += 1) {
      await act(async () => { jest.advanceTimersByTime(100); });
      if (screen.queryAllByText(/HTTP\/1\.1 304 Not Modified/).length > 0) break;
    }

    expect(screen.getAllByText(/HTTP\/1\.1 304 Not Modified/).length).toBeGreaterThan(0);
    expect(screen.getByText(/304 无正文/)).toBeInTheDocument();
  });
});
