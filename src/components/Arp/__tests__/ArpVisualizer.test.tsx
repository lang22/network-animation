import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ArpVisualizer from '@/components/Arp/ArpVisualizer';

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
    <ArpVisualizer />
  </MemoryRouter>,
);

describe('ArpVisualizer', () => {
  it('渲染控制面板、主机表与缓存面板', () => {
    renderPage();

    expect(screen.getByText('ARP 协议')).toBeInTheDocument();
    expect(screen.getByText('📄 ARP 缓存')).toBeInTheDocument();
    expect(screen.getByText('局域网主机')).toBeInTheDocument();
    expect(screen.getAllByText(/192\.168\.1\.10/).length).toBeGreaterThan(0);
  });

  it('广播阶段同时出现两个请求包', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByText('📣 发送 ARP 请求'));
    await act(async () => { jest.advanceTimersByTime(120); });

    expect(screen.getAllByText('ARP Request（广播）').length).toBe(2);
  });

  it('完成后写入 ARP 缓存', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByText('📣 发送 ARP 请求'));

    for (let i = 0; i < 120; i += 1) {
      await act(async () => { jest.advanceTimersByTime(50); });
      if (screen.queryAllByText(/地址已解析/).length > 0) break;
    }

    expect(screen.getAllByText(/地址已解析/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('aa:bb:cc:00:00:02').length).toBeGreaterThan(0);
    expect(screen.getByText(/ARP 表/)).toBeInTheDocument();
  });
});
