import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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
});
