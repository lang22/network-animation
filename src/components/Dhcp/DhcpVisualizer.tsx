import React, { useState } from 'react';
import styled from 'styled-components';
import Header from '@/components/Layout/Header';
import FlowCanvas from '@/components/Flow/FlowCanvas';
import { useStepFlow } from '@/hooks/useStepFlow';
import {
  DHCP_LEASE, DHCP_NODES, DHCP_STATES, buildDhcpExchange, dhcpStateAt,
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
  const flow = useStepFlow(speed);
  const done = flow.status === 'done';

  const start = () => {
    void flow.play(buildDhcpExchange());
  };

  const statusText = done
    ? '✅ 租约获取成功'
    : flow.status === 'playing'
      ? (flow.packet ? `进行中：${flow.packet.step.label}` : '进行中…')
      : '待获取地址';

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
              <Placeholder>第 {flow.currentIndex + 1} / 4 步</Placeholder>
            )}
          </PanelC>
        </Panel>

        <FlowCanvas nodes={DHCP_NODES} packet={flow.packet} />

        <Panel>
          <PanelH>📄 租约信息</PanelH>
          <PanelC>
            <SectionTitle>状态机</SectionTitle>
            {DHCP_STATES.map((state, index) => (
              <StateItem
                key={state}
                $active={index === flow.currentIndex}
                $done={flow.currentIndex > index || done}
              >
                {flow.currentIndex > index || done ? '✓' : index === flow.currentIndex ? '▶' : '·'} {state}
              </StateItem>
            ))}

            {done ? (
              <>
                <SectionTitle>租约</SectionTitle>
                <ResultRow>IP 地址 <span>{DHCP_LEASE.ip}</span></ResultRow>
                <ResultRow>子网掩码 <span>{DHCP_LEASE.mask}</span></ResultRow>
                <ResultRow>默认网关 <span>{DHCP_LEASE.gateway}</span></ResultRow>
                <ResultRow>DNS <span>{DHCP_LEASE.dns}</span></ResultRow>
                <ResultRow>租期 <span>{DHCP_LEASE.leaseHours} 小时</span></ResultRow>
                <Placeholder>租期过半后客户端会续租（Renew），到期未续则回到 INIT</Placeholder>
              </>
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
