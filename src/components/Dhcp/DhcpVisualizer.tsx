import React, { useState } from 'react';
import styled from 'styled-components';
import Header from '@/components/Layout/Header';
import FlowCanvas from '@/components/Flow/FlowCanvas';
import { useStepFlow } from '@/hooks/useStepFlow';
import {
  DHCP_LEASE, DHCP_NODES, DHCP_STATES, buildDhcpExchange, buildDhcpRelease,
  buildDhcpRenew, dhcpStateAt,
} from '@/services/protocols/dhcpService';
import {
  Page, Main, Panel, PanelH, PanelC, Btn, FieldLabel, Row, ChoiceBtn,
  StatusBox, SectionTitle, ResultRow, LogLine, Placeholder,
} from '@/components/Flow/flowStyles';
import { darkTheme } from '@/styles/theme';

const StateItem = styled.div<{ $active: boolean; $done: boolean }>`
  display: flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  color: ${({ $active, $done }) => $active ? darkTheme.colors.primary : $done ? darkTheme.colors.success : darkTheme.colors.textMuted};
  opacity: ${({ $active, $done }) => ($active || $done) ? 1 : 0.4};
  padding: 3px 0;
`;

const DhcpVisualizer: React.FC = () => {
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<'dora' | 'renew' | 'release'>('dora');
  const flow = useStepFlow(speed);
  const done = flow.status === 'done';
  const leaseActive = done && mode !== 'release';
  const canManage = done && mode !== 'release' && flow.status !== 'playing';

  const start = () => {
    setMode('dora');
    void flow.play(buildDhcpExchange());
  };

  const renew = () => {
    setMode('renew');
    void flow.play(buildDhcpRenew());
  };

  const release = () => {
    setMode('release');
    void flow.play(buildDhcpRelease());
  };

  const statusText = flow.status === 'playing'
    ? (flow.packet ? `进行中：${flow.packet.step.label}` : '进行中…')
    : done
      ? (mode === 'release'
        ? '🗑 已释放，回到 INIT'
        : mode === 'renew' ? '✅ 续租成功（BOUND）' : '✅ 租约获取成功')
      : mode === 'release' ? '已释放' : '待获取地址';

  return (
    <Page>
      <Header title="DHCP 协议" />
      <Main>
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn $v="accent" disabled={flow.status === 'playing'} onClick={start}>
              📡 开始获取地址
            </Btn>
            <Row>
              <Btn disabled={!canManage} style={{ flex: 1 }} onClick={renew}>♻️ 续租</Btn>
              <Btn disabled={!canManage} style={{ flex: 1 }} onClick={release}>🗑 释放</Btn>
            </Row>
            <Btn disabled={flow.status === 'playing'} onClick={flow.reset}>重置</Btn>

            <FieldLabel>速度</FieldLabel>
            <Row>
              {[0.5, 1, 2].map(item => (
                <ChoiceBtn key={item} $a={speed === item} onClick={() => setSpeed(item)}>
                  {item}x
                </ChoiceBtn>
              ))}
            </Row>

            <StatusBox $tone={done ? 'done' : flow.status === 'playing' ? 'active' : 'idle'}>
              {statusText}
            </StatusBox>
            {flow.status === 'playing' && (
              <Placeholder>第 {flow.currentIndex + 1} / {flow.total} 步</Placeholder>
            )}
          </PanelC>
        </Panel>

        <FlowCanvas nodes={DHCP_NODES} packet={flow.packet} />

        <Panel>
          <PanelH>📄 租约信息</PanelH>
          <PanelC>
            <SectionTitle>状态机</SectionTitle>
            {DHCP_STATES.map((state, index) => {
              // 释放后客户端回到 INIT，状态机不能还显示全部走完
              const released = mode === 'release' && done;
              const active = released ? index === 0 : index === flow.currentIndex;
              const completed = !released && (flow.currentIndex > index || done);
              return (
                <StateItem key={state} $active={active} $done={completed}>
                  {completed ? '✓' : active ? '▶' : '·'} {state}
                </StateItem>
              );
            })}

            {leaseActive ? (
              <>
                <SectionTitle>租约</SectionTitle>
                <ResultRow>IP 地址 <span>{DHCP_LEASE.ip}</span></ResultRow>
                <ResultRow>子网掩码 <span>{DHCP_LEASE.mask}</span></ResultRow>
                <ResultRow>默认网关 <span>{DHCP_LEASE.gateway}</span></ResultRow>
                <ResultRow>DNS <span>{DHCP_LEASE.dns}</span></ResultRow>
                <ResultRow>租期 <span>{DHCP_LEASE.leaseHours} 小时</span></ResultRow>
                <Placeholder>
                  {mode === 'renew'
                    ? '续租成功，租期重新计时；下次 T1 再续，到期未续则回到 INIT'
                    : '租期过半（T1）后可续租（Renew），也可以主动释放（Release）'}
                </Placeholder>
              </>
            ) : done && mode === 'release' ? (
              <Placeholder>地址已释放，服务器可重新分配，客户端回到 INIT</Placeholder>
            ) : (
              <Placeholder>（点击「开始获取地址」查看 DORA 四步）</Placeholder>
            )}

            <SectionTitle>事件日志</SectionTitle>
            {flow.log.length === 0
              ? <Placeholder>（尚未开始）</Placeholder>
              : flow.log.map(entry => <LogLine key={entry.id}>{entry.text}</LogLine>)}
          </PanelC>
        </Panel>
      </Main>
    </Page>
  );
};

export default DhcpVisualizer;
