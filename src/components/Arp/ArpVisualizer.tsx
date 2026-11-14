import React, { useState } from 'react';
import Header from '@/components/Layout/Header';
import FlowCanvas from '@/components/Flow/FlowCanvas';
import { useStepFlow } from '@/hooks/useStepFlow';
import {
  ARP_HOSTS_INFO, ARP_NODES, ArpResult, ArpTargetId, buildArpExchange,
} from '@/services/protocols/arpService';
import {
  Page, Main, Panel, PanelH, PanelC, Btn, FieldLabel, Row, ChoiceBtn,
  StatusBox, SectionTitle, ResultRow, LogLine, Placeholder,
} from '@/components/Flow/flowStyles';

const ArpVisualizer: React.FC = () => {
  const [speed, setSpeed] = useState(1);
  const [targetId, setTargetId] = useState<ArpTargetId>('b');
  const [result, setResult] = useState<ArpResult | null>(null);
  const flow = useStepFlow(speed);

  const start = () => {
    const exchange = buildArpExchange(targetId);
    setResult(exchange.result);
    void flow.play(exchange.steps);
  };

  const reset = () => {
    flow.reset();
    setResult(null);
  };

  const done = flow.status === 'done';
  const statusText = done
    ? '✅ 地址已解析（ARP 缓存已更新）'
    : flow.status === 'playing'
      ? (flow.packet ? `进行中：${flow.packet.step.label}` : '进行中…')
      : '待解析';

  return (
    <Page>
      <Header title="ARP 协议" />
      <Main>
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn $v="accent" disabled={flow.status === 'playing'} onClick={start}>
              📣 发送 ARP 请求
            </Btn>
            <Btn disabled={flow.status === 'playing'} onClick={reset}>重置</Btn>

            <FieldLabel>要解析哪台主机</FieldLabel>
            <Row>
              {ARP_HOSTS_INFO.filter(host => host.id !== 'a').map(host => (
                <ChoiceBtn
                  key={host.id}
                  $a={targetId === host.id}
                  disabled={flow.status === 'playing'}
                  onClick={() => setTargetId(host.id as ArpTargetId)}
                >
                  {host.name.replace('主机 ', '')}
                </ChoiceBtn>
              ))}
            </Row>
            <Placeholder>
              {targetId === 'b' ? '目标：192.168.1.20' : '目标：192.168.1.30'}
            </Placeholder>

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

        <FlowCanvas nodes={ARP_NODES} packet={flow.packet} />

        <Panel>
          <PanelH>📄 ARP 缓存</PanelH>
          <PanelC>
            {done && result ? (
              <>
                <SectionTitle>主机 A 的 ARP 表</SectionTitle>
                <ResultRow>{result.targetIp} <span>{result.targetMac}</span></ResultRow>
                <ResultRow>TTL <span>{result.ttlSeconds}s</span></ResultRow>
                <SectionTitle>本次报文</SectionTitle>
                <ResultRow>请求方 <span>{result.requesterIp} · {result.requesterMac}</span></ResultRow>
                <ResultRow>广播地址 <span>{result.broadcastMac}</span></ResultRow>
                <Placeholder>
                  ARP 缓存过期（默认几十秒到几分钟）后要重新广播解析；跨网段时解析的是网关的 MAC
                </Placeholder>
              </>
            ) : (
              <Placeholder>（点击「发送 ARP 请求」查看广播解析过程）</Placeholder>
            )}

            <SectionTitle>局域网主机</SectionTitle>
            {ARP_HOSTS_INFO.map(host => (
              <ResultRow key={host.id}>{host.name} <span>{host.ip} · {host.mac}</span></ResultRow>
            ))}

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

export default ArpVisualizer;
