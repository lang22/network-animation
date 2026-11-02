import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DnsVisualizer from '@/components/Dns/DnsVisualizer';

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
    <DnsVisualizer />
  </MemoryRouter>,
);

describe('DnsVisualizer', () => {
  it('渲染控制面板与结果面板', () => {
    renderPage();

    expect(screen.getByText('DNS 协议')).toBeInTheDocument();
    expect(screen.getByText('📄 解析结果')).toBeInTheDocument();
    expect(screen.getByText(/点击「开始解析」/)).toBeInTheDocument();
  });

  it('解析完成后展示地址与缓存', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByText('🔍 开始解析'));
    expect(screen.getAllByText(/解析中/).length).toBeGreaterThan(0);

    for (let i = 0; i < 200; i += 1) {
      await act(async () => { jest.advanceTimersByTime(50); });
      if (screen.queryAllByText('93.184.216.34').length > 0) break;
    }

    expect(screen.getAllByText('93.184.216.34').length).toBeGreaterThan(0);
    expect(screen.getByText('本机缓存')).toBeInTheDocument();
    expect(screen.getByText(/解析完成/)).toBeInTheDocument();
  });

  it('可以切换记录类型', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'AAAA' }));
    expect(screen.getByRole('button', { name: 'AAAA' })).toBeInTheDocument();
  });
});
