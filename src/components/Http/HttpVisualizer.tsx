import React, { useMemo, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { useHttpFlow } from '@/hooks/useHttpFlow';
import Header from '@/components/Layout/Header';
import { formatMessage, reasonPhrase, TLS_STEPS, DEFAULT_PATH } from '@/services/protocols/httpService';
import { HttpMethod, HttpPhase } from '@/types/httpTypes';

// ==================== 布局 ====================
const Page = styled.div`
  width: 100vw; height: 100vh;
  display: grid; grid-template-rows: 48px 1fr;
  background: ${darkTheme.colors.background}; overflow: hidden;
`;
const Main = styled.div`
  display: grid; grid-template-columns: 220px 1fr 320px;
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
const Btn = styled.button<{ $v?: 'primary' | 'accent' | 'ghost' }>`
  width: 100%; padding: 11px 14px; border-radius: 8px;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none;
  ${({ $v }) => $v === 'accent' ? `
    background: linear-gradient(90deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondaryLight});
    color: #fff; box-shadow: 0 0 12px ${darkTheme.colors.glow};
  ` : $v === 'primary' ? `
    background: ${darkTheme.colors.primary}; color: #000;
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
const MethodRow = styled.div` display: flex; gap: 6px; `;
const MethodBtn = styled.button<{ $a?: boolean }>`
  flex: 1; padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted};
  font-size: 11px; font-weight: 600;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Status = styled.div<{ $tone: 'idle' | 'active' | 'done' }>`
  padding: 10px; border-radius: 0 6px 6px 0; font-size: 11px;
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
const ChannelLabel = styled.div`
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: ${darkTheme.colors.textMuted};
  padding: 4px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; }
`;
const PhaseBadge = styled.div<{ $phase: HttpPhase }>`
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
  padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 700;
  letter-spacing: 1px; z-index: 15; pointer-events: none;
  animation: ${pulse} 2s ease-in-out infinite;
  background: ${({ $phase }) =>
    $phase === 'idle' ? 'rgba(255,255,255,0.06)' :
    $phase === 'processing' ? 'rgba(234,179,8,0.15)' :
    $phase === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.15)'};
  color: ${({ $phase }) =>
    $phase === 'idle' ? darkTheme.colors.textMuted :
    $phase === 'processing' ? darkTheme.colors.warning :
    $phase === 'done' ? darkTheme.colors.success : darkTheme.colors.primary};
  border: 1px solid currentColor;
`;
const Packet = styled.div<{ $kind: 'request' | 'response' | 'tls' }>`
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  padding: 8px 14px; border-radius: 18px; z-index: 20; white-space: nowrap;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
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
  color: ${darkTheme.colors.textLight}; max-height: 240px; white-space: pre-wrap;
  word-break: break-all;
`;
const LogLine = styled.div`
  font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.8;
  color: ${darkTheme.colors.textMuted};
`;

const phaseLabel = (phase: HttpPhase) => {
  if (phase === 'client-hello') return '🔐 TLS：ClientHello';
  if (phase === 'server-hello') return '🔐 TLS：ServerHello + 证书';
  if (phase === 'client-finished') return '🔐 TLS：Finished';
  if (phase === 'request') return '📤 发送请求';
  if (phase === 'processing') return '⚙ 服务器处理中';
  if (phase === 'response') return '📥 返回响应';
  if (phase === 'done') return '✅ 完成';
  return '待发送';
};

const HttpVisualizer: React.FC = () => {
  const [speed, setSpeed] = useState(1);
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState(DEFAULT_PATH);
  const [postBody, setPostBody] = useState('user=admin&pass=123');
  const [status, setStatus] = useState(200);
  const [secure, setSecure] = useState(false);
  const flow = useHttpFlow(speed);

  const requestText = useMemo(
    () => (flow.request ? formatMessage(flow.request) : '（尚未发送）'),
    [flow.request],
  );
  const responseText = useMemo(
    () => (flow.response ? formatMessage(flow.response) : '（等待响应）'),
    [flow.response],
  );

  const tlsStep = TLS_STEPS.find(step => step.phase === flow.phase);
  const onCanvas = Boolean(tlsStep) || flow.phase === 'request' || flow.phase === 'response';
  const packetKind = tlsStep ? 'tls' : flow.phase === 'response' ? 'response' : 'request';
  const toLeft = flow.phase === 'response' || tlsStep?.direction === 'to-client';
  // 用 CSS calc 贴着两个端点盒子走，画布宽度变化时也不会飞进盒子里
  const track = toLeft ? 1 - flow.progress : flow.progress;
  const packetLeft = `calc(146px + (100% - 292px) * ${track})`;
  const responseLabel = flow.response
    ? flow.response.startLine.replace('HTTP/1.1 ', '')
    : `${status} ${reasonPhrase(status)}`;
  const packetLabel = tlsStep
    ? tlsStep.label
    : flow.phase === 'response'
      ? responseLabel
      : `${method} ${path}`;

  const handshakeDone = secure && ['request', 'processing', 'response', 'done'].includes(flow.phase);
  const channelLabel = secure
    ? (handshakeDone ? 'TLS 1.3 已加密 · keep-alive' : '正在建立 TLS 连接…')
    : '已建立 TCP 连接 · keep-alive';

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
              onClick={() => flow.send(method, path, method === 'POST' ? postBody : '', status, secure)}
            >
              📨 发送请求
            </Btn>
            <Btn disabled={flow.isSending} onClick={flow.reset}>重置</Btn>

            <FieldLabel>协议</FieldLabel>
            <MethodRow>
              {[
                { label: 'HTTP', value: false },
                { label: 'HTTPS', value: true },
              ].map(item => (
                <MethodBtn
                  key={item.label}
                  $a={secure === item.value}
                  disabled={flow.isSending}
                  onClick={() => setSecure(item.value)}
                >
                  {item.label}
                </MethodBtn>
              ))}
            </MethodRow>

            <FieldLabel>请求方法</FieldLabel>
            <MethodRow>
              {(['GET', 'POST'] as HttpMethod[]).map(item => (
                <MethodBtn
                  key={item}
                  $a={method === item}
                  disabled={flow.isSending}
                  onClick={() => setMethod(item)}
                >
                  {item}
                </MethodBtn>
              ))}
            </MethodRow>

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
            <MethodRow>
              {[200, 404, 500].map(item => (
                <MethodBtn
                  key={item}
                  $a={status === item}
                  disabled={flow.isSending}
                  onClick={() => setStatus(item)}
                >
                  {item}
                </MethodBtn>
              ))}
            </MethodRow>

            <FieldLabel>速度</FieldLabel>
            <MethodRow>
              {[0.5, 1, 2].map(item => (
                <MethodBtn key={item} $a={speed === item} onClick={() => setSpeed(item)}>
                  {item}x
                </MethodBtn>
              ))}
            </MethodRow>

            <Status $tone={flow.phase === 'done' ? 'done' : flow.phase === 'idle' ? 'idle' : 'active'}>
              {phaseLabel(flow.phase)}
            </Status>
          </PanelC>
        </Panel>

        {/* ── 中间画布 ── */}
        <CanvasPanel data-testid="http-canvas">
          <PhaseBadge $phase={flow.phase}>{phaseLabel(flow.phase)}</PhaseBadge>

          <Endpoint $type="client">
            <EndpointTitle>🌐 浏览器</EndpointTitle>
            <EndpointHint>客户端<br />示例：Chrome</EndpointHint>
          </Endpoint>

          <Endpoint $type="server">
            <EndpointTitle>🖥 服务器</EndpointTitle>
            <EndpointHint>example.com<br />HTTP/1.1</EndpointHint>
          </Endpoint>

          <Channel />
          <ChannelLabel>{channelLabel}</ChannelLabel>

          {onCanvas && (
            <Packet $kind={packetKind} style={{ left: packetLeft }}>
              {packetLabel}
            </Packet>
          )}
        </CanvasPanel>

        {/* ── 右侧详情 ── */}
        <Panel>
          <PanelH>📄 报文详情</PanelH>
          <PanelC>
            <SectionTitle>请求{secure ? '（经 TLS 加密）' : ''}</SectionTitle>
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
