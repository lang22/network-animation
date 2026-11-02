import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DhcpVisualizer from '@/components/Dhcp/DhcpVisualizer';

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
    <DhcpVisualizer />
  </MemoryRouter>,
);

describe('DhcpVisualizer', () => {
  it('渲染控制面板、状态机与租约面板', () => {
    renderPage();

    expect(screen.getByText('DHCP 协议')).toBeInTheDocument();
    expect(screen.getByText('📄 租约信息')).toBeInTheDocument();
    expect(screen.getByText(/INIT/)).toBeInTheDocument();
    expect(screen.getByText(/BOUND/)).toBeInTheDocument();
  });

  it('完成 DORA 后展示租约', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    fireEvent.click(screen.getByText('📡 开始获取地址'));

    for (let i = 0; i < 200; i += 1) {
      await act(async () => { jest.advanceTimersByTime(50); });
      if (screen.queryAllByText('192.168.1.100').length > 0) break;
    }

    expect(screen.getAllByText('192.168.1.100').length).toBeGreaterThan(0);
    expect(screen.getByText(/租约获取成功/)).toBeInTheDocument();
    expect(screen.getAllByText(/24 小时/).length).toBeGreaterThan(0);
  });
});
