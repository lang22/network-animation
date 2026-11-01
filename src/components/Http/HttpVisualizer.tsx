import React, { useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { useHttpFlow } from '@/hooks/useHttpFlow';
import Header from '@/components/Layout/Header';
import { formatMessage, reasonPhrase, DEFAULT_PATH } from '@/services/protocols/httpService';
import { HttpMethod, HttpPhase, HttpVersion, StreamStatus } from '@/types/httpTypes';

// ==================== 布局 ====================
const Page = styled.div`
  width: 100vw; height: 100vh;
  display: grid; grid-template-rows: 48px 1fr;
  background: ${darkTheme.colors.background}; overflow: hidden;
`;
const Main = styled.div`
  display: grid; grid-template-columns: 220px 1fr 340px;
  gap: 16px; padding: 16px; height: 100%; box-sizing: border-box;
  min-height: 0; overflow: hidden;
`;
const Panel = styled.div`
  background: ${darkTheme.colors.surface}; border-radius: 12px;
  border: 1px solid ${darkTheme.colors.border};
  display: flex; flex-direction: column; overflow: hidden; min-height: 0;
`;
const PanelH = styled.div`
  padding: 14px 16px; border-bottom: 1px solid ${darkTheme.colors.border};
  font-size: 13px; font-weight: 600; color: ${darkTheme.colors.text};
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
`;
const PanelC = styled.div`
  padding: 14px; display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto; flex: 1; min-height: 0;
`;

// ==================== 控件 ====================
const Btn = styled.button<{ $v?: 'primary' | 'accent' }>`
  width: 100%; padding: 11px 14px; border-radius: 8px;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none;
  ${({ $v }) => $v === 'accent' ? `
    background: linear-gradient(90deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondaryLight});
    color: #fff; box-shadow: 0 0 12px ${darkTheme.colors.glow};
  ` : `
    background: ${darkTheme.colors.surfaceLight}; color: ${darkTheme.colors.text};
    border: 1px solid ${darkTheme.colors.border};
  `}
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.85; }
`;
const FieldLabel = styled.div` font-size: 10px; color: ${darkTheme.colors.textMuted}; `;
const Input = styled.input`
  width: 100%; box-sizing: border-box; padding: 8px 10px;
  border-radius: 6px; border: 1px solid ${darkTheme.colors.border};
  background: rgba(0,0,0,0.25); color: ${darkTheme.colors.text};
  font-size: 11px; font-family: 'JetBrains Mono', monospace;
`;
const Row = styled.div` display: flex; gap: 6px; `;
const ChoiceBtn = styled.button<{ $a?: boolean }>`
  flex: 1; padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted};
  font-size: 11px; font-weight: 600;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const StatusBox = styled.div<{ $tone: 'idle' | 'active' | 'done' }>`
  padding: 10px; border-radius: 0 6px 6px 0; font-size: 11px; line-height: 1.6;
  border-left: 3px solid ${({ $tone }) =>
    $tone === 'done' ? darkTheme.colors.success :
    $tone === 'active' ? darkTheme.colors.primary : darkTheme.colors.border};
  background: rgba(0,212,255,0.08);
  color: ${darkTheme.colors.text};
`;

// ==================== 画布 ====================
const CanvasPanel = styled.div`
  background: ${darkTheme.colors.surface}; border-radius: 12px;
  border: 1px solid ${darkTheme.colors.border};
  position: relative; overflow: hidden;
`;
const Endpoint = styled.div<{ $type: 'client' | 'server' }>`
  position: absolute; top: 16px; bottom: 16px; width: 130px;
  ${({ $type }) => $type === 'client' ? 'left: 16px;' : 'right: 16px;'}
  border-radius: 14px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px; padding: 20px 12px;
  color: #fff; border: 1px solid rgba(255,255,255,0.15);
  background: linear-gradient(180deg,
    ${({ $type }) => $type === 'client' ? '#166534' : '#1e40af'} 0%,
    ${({ $type }) => $type === 'client' ? '#14532d' : '#1e3a8a'} 100%);
`;
const EndpointTitle = styled.div` font-size: 15px; font-weight: 700; `;
const EndpointHint = styled.div` font-size: 11px; opacity: 0.6; text-align: center; line-height: 1.6; `;

const Channel = styled.div`
  position: absolute; top: 50%; left: 146px; right: 146px;
  height: 1px; background: ${darkTheme.colors.border}; opacity: 0.4;
`;
const StageLabel = styled.div`
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: ${darkTheme.colors.textMuted}; max-width: 80%;
  padding: 4px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
`;
const PhaseBadge = styled.div<{ $phase: HttpPhase }>`
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
  padding: 8px 18px; border-radius: 20px; font-size: 12px; font-weight: 700;
  z-index: 15; pointer-events: none; max-width: 78%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: ${pulse} 2s ease-in-out infinite;
  background: ${({ $phase }) =>
    $phase === 'idle' ? 'rgba(255,255,255,0.06)' :
    $phase === 'tls' ? 'rgba(52,211,153,0.15)' :
    $phase === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.15)'};
  color: ${({ $phase }) =>
    $phase === 'idle' ? darkTheme.colors.textMuted :
    $phase === 'tls' ? '#34d399' :
    $phase === 'done' ? darkTheme.colors.success : darkTheme.colors.primary};
  border: 1px solid currentColor;
`;
const Packet = styled.div<{ $kind: 'request' | 'response' | 'tls' }>`
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  padding: 7px 12px; border-radius: 16px; z-index: 20; white-space: nowrap;
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
  background: ${({ $kind }) => $kind === 'request'
    ? 'linear-gradient(135deg, #38bdf8, #0284c7)'
    : $kind === 'tls'
      ? 'linear-gradient(135deg, #34d399, #059669)'
      : 'linear-gradient(135deg, #a78bfa, #7c3aed)'};
  color: #fff; box-shadow: 0 0 14px rgba(56,189,248,0.35);
`;

// ==================== 详情 ====================
const SectionTitle = styled.div`
  font-size: 11px; font-weight: 600; color: ${darkTheme.colors.textMuted};
  margin-top: 4px;
`;
const Code = styled.pre`
  margin: 0; padding: 10px; border-radius: 8px; overflow: auto;
  background: rgba(0,0,0,0.3); border: 1px solid ${darkTheme.colors.border};
  font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.6;
  color: ${darkTheme.colors.textLight}; max-height: 220px; white-space: pre-wrap;
  word-break: break-all;
`;
const LogLine = styled.div`
  font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.8;
  color: ${darkTheme.colors.textMuted};
`;
const StreamRow = styled.div` display: flex; flex-wrap: wrap; gap: 6px; `;
const StreamChip = styled.button<{ $active?: boolean }>`
  padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $active }) => $active ? 'rgba(0,212,255,0.15)' : 'transparent'};
  color: ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.textMuted};
`;

const statusIcon = (status: StreamStatus) => {
  if (status === 'requesting') return '→';
  if (status === 'processing') return '⚙';
  if (status === 'responding') return '←';
  if (status === 'done') return '✓';
  return '·';
};

const HttpVisualizer: React.FC = () => {
  const [speed, setSpeed] = useState(1);
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState(DEFAULT_PATH);
  const [postBody, setPostBody] = useState('user=admin&pass=123');
  const [status, setStatus] = useState(200);
  const [secure, setSecure] = useState(false);
  const [version, setVersion] = useState<HttpVersion>('http1');
  const flow = useHttpFlow(speed);

  const selected = flow.streams.find(stream => stream.id === flow.selectedStreamId);
  const requestText = useMemo(() => {
    const request = flow.requests[flow.selectedStreamId];
    return request ? formatMessage(request) : '（尚未发送）';
  }, [flow.requests, flow.selectedStreamId]);
  const responseText = useMemo(() => {
    const response = flow.responses[flow.selectedStreamId];
    return response ? formatMessage(response) : '（等待响应）';
  }, [flow.responses, flow.selectedStreamId]);

  const channelLabel = secure
    ? (flow.phase === 'tls' ? '正在建立 TLS 连接…' : 'TLS 1.3 已加密 · keep-alive')
    : (version === 'http2' ? 'HTTP/2 · 单连接多流' : 'HTTP/1.1 · keep-alive');

  return (
    <Page>
      <Header title="HTTP 协议" />
      <Main>
        {/* ── 左侧控制 ── */}
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn
              $v="accent"
              disabled={flow.isSending}
              onClick={() => flow.send({
                method,
                path,
                body: method === 'POST' ? postBody : '',
                status,
                secure,
                version,
              })}
            >
              📨 发送请求
            </Btn>
            <Btn disabled={flow.isSending} onClick={flow.reset}>重置</Btn>

            <FieldLabel>协议</FieldLabel>
            <Row>
              {[
                { label: 'HTTP', value: false },
                { label: 'HTTPS', value: true },
              ].map(item => (
                <ChoiceBtn
                  key={item.label}
                  $a={secure === item.value}
                  disabled={flow.isSending}
                  onClick={() => setSecure(item.value)}
                >
                  {item.label}
                </ChoiceBtn>
              ))}
            </Row>

            <FieldLabel>版本</FieldLabel>
            <Row>
              {[
                { label: 'HTTP/1.1', value: 'http1' as HttpVersion },
                { label: 'HTTP/2', value: 'http2' as HttpVersion },
              ].map(item => (
                <ChoiceBtn
                  key={item.value}
                  $a={version === item.value}
                  disabled={flow.isSending}
                  onClick={() => setVersion(item.value)}
                >
                  {item.label}
                </ChoiceBtn>
              ))}
            </Row>

            <FieldLabel>请求方法</FieldLabel>
            <Row>
              {(['GET', 'POST'] as HttpMethod[]).map(item => (
                <ChoiceBtn
                  key={item}
                  $a={method === item}
                  disabled={flow.isSending}
                  onClick={() => setMethod(item)}
                >
                  {item}
                </ChoiceBtn>
              ))}
            </Row>

            <FieldLabel>请求路径</FieldLabel>
            <Input
              value={path}
              disabled={flow.isSending}
              onChange={event => setPath(event.target.value.trim() || '/')}
            />

            {method === 'POST' && (
              <>
                <FieldLabel>请求体（application/x-www-form-urlencoded）</FieldLabel>
                <Input
                  value={postBody}
                  disabled={flow.isSending}
                  onChange={event => setPostBody(event.target.value)}
                />
              </>
            )}

            <FieldLabel>响应状态码</FieldLabel>
            <Row>
              {[200, 404, 500].map(item => (
                <ChoiceBtn
                  key={item}
                  $a={status === item}
                  disabled={flow.isSending}
                  onClick={() => setStatus(item)}
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

            <StatusBox $tone={flow.phase === 'done' ? 'done' : flow.phase === 'idle' ? 'idle' : 'active'}>
              {flow.stageLabel}
            </StatusBox>
          </PanelC>
        </Panel>

        {/* ── 中间画布 ── */}
        <CanvasPanel data-testid="http-canvas">
          <PhaseBadge $phase={flow.phase}>{flow.stageLabel}</PhaseBadge>

          <Endpoint $type="client">
            <EndpointTitle>🌐 浏览器</EndpointTitle>
            <EndpointHint>客户端<br />示例：Chrome</EndpointHint>
          </Endpoint>

          <Endpoint $type="server">
            <EndpointTitle>🖥 服务器</EndpointTitle>
            <EndpointHint>example.com<br />{version === 'http2' ? 'HTTP/2' : 'HTTP/1.1'}</EndpointHint>
          </Endpoint>

          <Channel />
          <StageLabel>{channelLabel}</StageLabel>

          {flow.flights.map(flight => {
            const toLeft = flight.direction === 'to-client';
            const track = toLeft ? 1 - flight.progress : flight.progress;
            // 每条流一条独立轨道，HTTP/2 并发时才看得出是多个包
            const lane = flight.streamId ? (flight.streamId - 2) * 56 : 0;
            return (
              <Packet
                key={flight.id}
                $kind={flight.kind}
                style={{
                  left: `calc(146px + (100% - 292px) * ${track})`,
                  top: `calc(50% + ${lane}px)`,
                }}
              >
                {flight.streamId ? `${flight.streamId} · ` : ''}{flight.label}
              </Packet>
            );
          })}
        </CanvasPanel>

        {/* ── 右侧详情 ── */}
        <Panel>
          <PanelH>📄 报文详情</PanelH>
          <PanelC>
            <SectionTitle>流（stream）</SectionTitle>
            <StreamRow>
              {flow.streams.length === 0
                ? <LogLine>（尚未发送）</LogLine>
                : flow.streams.map(stream => (
                  <StreamChip
                    key={stream.id}
                    $active={flow.selectedStreamId === stream.id}
                    onClick={() => flow.selectStream(stream.id)}
                  >
                    {statusIcon(stream.status)} {stream.id} · {stream.path}
                    {stream.responseStatus ? ` · ${stream.responseStatus}` : ''}
                  </StreamChip>
                ))}
            </StreamRow>

            <SectionTitle>请求{selected ? `（流 ${selected.id}${secure ? '，经 TLS 加密' : ''}）` : ''}</SectionTitle>
            <Code>{requestText}</Code>
            <SectionTitle>响应</SectionTitle>
            <Code>{responseText}</Code>

            <SectionTitle>事件日志</SectionTitle>
            {flow.log.length === 0
              ? <LogLine>（点击「发送请求」开始）</LogLine>
              : flow.log.map(entry => <LogLine key={entry.id}>{entry.text}</LogLine>)}
          </PanelC>
        </Panel>
      </Main>
    </Page>
  );
};

export default HttpVisualizer;
