import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { store } from '@/store';
import { reset } from '@/store/slices/congestionSlice';
import CongestionVisualizer from '@/components/CongestionControl/CongestionVisualizer';

beforeEach(() => {
  store.dispatch(reset());
});

const renderPage = () => render(
  <Provider store={store}>
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CongestionVisualizer />
    </MemoryRouter>
  </Provider>,
);

describe('CongestionVisualizer', () => {
  it('渲染中文控制面板与统计区', () => {
    renderPage();

    expect(screen.getByText('TCP 拥塞控制')).toBeInTheDocument();
    expect(screen.getByText('丢包率')).toBeInTheDocument();
    expect(screen.getByText('指定丢包序号')).toBeInTheDocument();
    expect(screen.getByText(/RTO 超时/)).toBeInTheDocument();
    expect(screen.getByText(/重传次数/)).toBeInTheDocument();
    expect(screen.getByText('⚡ 完整演示')).toBeInTheDocument();
  });

  it('丢包控制按钮能写入状态', () => {
    renderPage();

    fireEvent.click(screen.getByText('20%'));
    expect(store.getState().congestion.lossRate).toBe(0.2);

    fireEvent.click(screen.getByText(/丢下一个包 #1/));
    expect(store.getState().congestion.packetLossEnabled).toBe(true);
    expect(store.getState().congestion.dropNextSeq).toBe(1);
  });
});
