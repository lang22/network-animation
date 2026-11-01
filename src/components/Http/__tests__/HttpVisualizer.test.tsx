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

describe('HttpVisualizer', () => {
  it('渲染控制面板与报文详情', () => {
    renderPage();

    expect(screen.getByText('HTTP 协议')).toBeInTheDocument();
    expect(screen.getByText('📄 报文详情')).toBeInTheDocument();
    expect(screen.getByText('请求')).toBeInTheDocument();
    expect(screen.getByText('响应')).toBeInTheDocument();
    expect(screen.getByText('（尚未发送）')).toBeInTheDocument();
  });

  it('点击发送后进入请求阶段', () => {
    renderPage();

    fireEvent.click(screen.getByText('📨 发送请求'));

    expect(screen.getAllByText('📤 发送请求').length).toBeGreaterThan(0);
    expect(screen.queryByText('（尚未发送）')).not.toBeInTheDocument();
    expect(screen.getByText(/GET \/index\.html HTTP\/1\.1/)).toBeInTheDocument();
  });

  it('切到 POST 后显示请求体输入', () => {
    renderPage();

    expect(screen.queryByText(/请求体/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('POST'));
    expect(screen.getByText(/请求体/)).toBeInTheDocument();
  });

  it('选择 HTTPS 后先走 TLS 握手', async () => {
    renderPage();

    fireEvent.click(screen.getByText('HTTPS'));
    fireEvent.click(screen.getByText('📨 发送请求'));

    for (let i = 0; i < 4; i += 1) {
      await act(async () => { jest.advanceTimersByTime(200); });
    }

    expect(screen.getAllByText(/TLS：ClientHello/).length).toBeGreaterThan(0);
    expect(screen.getByText(/正在建立 TLS 连接/)).toBeInTheDocument();
  });

  it('选择 404 后响应报文显示 Not Found', async () => {
    renderPage();

    fireEvent.click(screen.getByText('404'));
    fireEvent.click(screen.getByText('📨 发送请求'));

    // 分片推进，让每个 await 之后的续体有机会安排新的定时器
    for (let i = 0; i < 15; i += 1) {
      await act(async () => { jest.advanceTimersByTime(200); });
    }

    expect(screen.getAllByText(/HTTP\/1\.1 404 Not Found/).length).toBeGreaterThan(0);
  });
});
