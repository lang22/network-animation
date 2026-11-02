import React, { useState } from 'react';
import Header from '@/components/Layout/Header';
import FlowCanvas from '@/components/Flow/FlowCanvas';
import { useStepFlow } from '@/hooks/useStepFlow';
import { DNS_NODES, DnsAnswer, DnsRecordType, buildDnsLookup } from '@/services/protocols/dnsService';
import {
  Page, Main, Panel, PanelH, PanelC, Btn, FieldLabel, Input, Row, ChoiceBtn,
  StatusBox, SectionTitle, ResultRow, LogLine, Placeholder,
} from '@/components/Flow/flowStyles';

const DnsVisualizer: React.FC = () => {
  const [speed, setSpeed] = useState(1);
  const [domain, setDomain] = useState('example.com');
  const [recordType, setRecordType] = useState<DnsRecordType>('A');
  const [answer, setAnswer] = useState<DnsAnswer | null>(null);
  const flow = useStepFlow(speed);

  const start = () => {
    const lookup = buildDnsLookup(domain, recordType);
    setAnswer(lookup.answer);
    void flow.play(lookup.steps);
  };

  const reset = () => {
    flow.reset();
    setAnswer(null);
  };

  const done = flow.status === 'done';
  const statusText = done
    ? '✅ 解析完成'
    : flow.status === 'playing'
      ? (flow.packet ? `解析中：${flow.packet.step.label}` : '解析中…')
      : '待解析';

  return (
    <Page>
      <Header title="DNS 协议" />
      <Main>
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn $v="accent" disabled={flow.status === 'playing'} onClick={start}>
              🔍 开始解析
            </Btn>
            <Btn disabled={flow.status === 'playing'} onClick={reset}>重置</Btn>

            <FieldLabel>域名</FieldLabel>
            <Input
              value={domain}
              disabled={flow.status === 'playing'}
              onChange={event => setDomain(event.target.value.trim() || 'example.com')}
            />

            <FieldLabel>记录类型</FieldLabel>
            <Row>
              {(['A', 'AAAA'] as DnsRecordType[]).map(item => (
                <ChoiceBtn
                  key={item}
                  $a={recordType === item}
                  disabled={flow.status === 'playing'}
                  onClick={() => setRecordType(item)}
                >
                  {item}
                </ChoiceBtn>
              ))}
            </Row>

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
              <Placeholder>第 {flow.currentIndex + 1} / 8 步</Placeholder>
            )}
          </PanelC>
        </Panel>

        <FlowCanvas nodes={DNS_NODES} packet={flow.packet} />

        <Panel>
          <PanelH>📄 解析结果</PanelH>
          <PanelC>
            {done && answer ? (
              <>
                <SectionTitle>答案</SectionTitle>
                <ResultRow>域名 <span>{answer.domain}</span></ResultRow>
                <ResultRow>类型 <span>{answer.type}</span></ResultRow>
                <ResultRow>结果 <span>{answer.value}</span></ResultRow>
                <ResultRow>TTL <span>{answer.ttl}s</span></ResultRow>
                <ResultRow>权威 <span>{answer.authoritative}</span></ResultRow>

                <SectionTitle>本机缓存</SectionTitle>
                <ResultRow>{answer.domain} <span>{answer.value}</span></ResultRow>
                <Placeholder>按 TTL {answer.ttl}s 缓存，再次访问直接命中，不再走递归</Placeholder>
              </>
            ) : (
              <Placeholder>（点击「开始解析」查看递归查询过程）</Placeholder>
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

export default DnsVisualizer;
