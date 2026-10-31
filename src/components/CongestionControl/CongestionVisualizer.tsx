import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { useCongestionControl } from '@/hooks/useCongestionControl';
import Header from '@/components/Layout/Header';
import AnimationCanvas from './AnimationCanvas';
import CwndChart from './CwndChart';

// ==================== 布局 ====================
const Page = styled.div`
  width: 100vw; height: 100vh;
  display: grid; grid-template-rows: 48px 1fr;
  background: ${darkTheme.colors.background}; overflow: hidden;
`;
const Main = styled.div`
  display: grid; grid-template-columns: 220px 1fr 280px;
  gap: 16px; padding: 16px; height: 100%; box-sizing: border-box;
  /* 不加 min-height:0，面板内容变高会把整行撑破，画布随之超出视口 */
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
  overflow-y: auto; flex: 1;
`;

// ==================== 按钮 ====================
const Btn = styled.button<{ $v?: 'primary' | 'accent' }>`
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
const ToggleRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; font-size: 11px; color: ${darkTheme.colors.text};
`;
const Toggle = styled.button<{ $on: boolean }>`
  width: 40px; height: 22px; border-radius: 11px; border: none;
  background: ${({ $on }) => $on ? darkTheme.colors.error : darkTheme.colors.border};
  cursor: pointer; transition: background 0.2s; position: relative;
  &::after {
    content: ''; position: absolute; top: 2px;
    ${({ $on }) => $on ? 'right: 2px;' : 'left: 2px;'}
    width: 18px; height: 18px; border-radius: 50%;
    background: white; transition: all 0.2s;
  }
`;
const SpeedBtn = styled.button<{ $a?: boolean }>`
  flex: 1; padding: 6px; border-radius: 5px;
  border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted}; font-size: 11px; cursor: pointer;
`;
const CompactGrid = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;
`;
const MiniBtn = styled.button<{ $a?: boolean }>`
  padding: 6px; border-radius: 5px; cursor: pointer;
  border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted};
  font-size: 10px; font-weight: 600;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const NumberInput = styled.input`
  width: 100%; box-sizing: border-box; padding: 8px 10px;
  border-radius: 6px; border: 1px solid ${darkTheme.colors.border};
  background: rgba(0,0,0,0.25); color: ${darkTheme.colors.text};
  font-size: 11px;
`;
const Status = styled.div`
  padding: 10px; background: rgba(0,212,255,0.08);
  border-left: 3px solid ${darkTheme.colors.primary};
  border-radius: 0 6px 6px 0; font-size: 11px; color: ${darkTheme.colors.text};
`;
const StatRow = styled.div`
  display: flex; justify-content: space-between; padding: 6px 0;
  font-size: 11px; color: ${darkTheme.colors.text};
  border-bottom: 1px solid ${darkTheme.colors.border};
  span { color: ${darkTheme.colors.primary}; font-weight: 600; }
`;
const WindowGrid = styled.div`
  display: flex; gap: 3px; flex-wrap: wrap; min-height: 20px;
  padding: 6px 8px; background: rgba(0,0,0,0.2); border-radius: 6px;
  align-items: center;
`;
const WinSlot = styled.div<{ $s: 'free' | 'sent' | 'acked'; $w: number }>`
  width: ${({ $w }) => $w}px; height: 14px; border-radius: 3px;
  transition: all 0.3s ease;
  background: ${({ $s }) => $s === 'acked' ? darkTheme.colors.success : $s === 'sent' ? darkTheme.colors.primary : 'transparent'};
  border: 1px solid ${({ $s }) => $s === 'free' ? darkTheme.colors.border : 'transparent'};
  box-shadow: ${({ $s }) => $s === 'sent' ? `0 0 6px ${darkTheme.colors.glow}` : 'none'};
`;
const LogArea = styled.div`
  flex: 1; min-height: 120px; max-height: 280px;
  overflow-y: auto; background: rgba(0,0,0,0.25);
  border-radius: 8px; border: 1px solid ${darkTheme.colors.border};
  padding: 6px; font-family: 'JetBrains Mono', monospace;
  font-size: 9px; line-height: 1.7;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;
`;
const LogLine = styled.div<{ $type: string }>`
  color: ${({ $type }) =>
    $type === 'rtt' ? darkTheme.colors.primary :
    $type === 'error' ? darkTheme.colors.error :
    $type === 'timeout' ? darkTheme.colors.warning :
    $type === 'retransmit' ? darkTheme.colors.primaryLight :
    $type === 'dup_ack' ? darkTheme.colors.warning :
    $type === 'fast_retransmit' ? darkTheme.colors.secondaryLight :
    $type === 'partial_ack' ? darkTheme.colors.accent :
    $type === 'sack' ? darkTheme.colors.primaryLight :
    $type === 'success' ? darkTheme.colors.success :
    darkTheme.colors.textMuted};
  opacity: 0.85;
`;
const phaseLabel = (p: string) => {
  if (p === 'slow_start') return '🚀 慢启动';
  if (p === 'congestion_avoidance') return '🔵 拥塞避免';
  if (p === 'fast_recovery') return '🔴 快速恢复';
  if (p === 'timeout') return '⏱ 超时';
  return p;
};

// ==================== 主组件 ====================
const CongestionVisualizer: React.FC = () => {
  const logAreaRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const ctrl = useCongestionControl(speed);

  // 只滚动日志容器本身；scrollIntoView 会把整个页面一起滚走
  useEffect(() => {
    const area = logAreaRef.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [ctrl.eventLog.length]);

  const inFlight = ctrl.flightBalls.filter(b => !b.isAck && !b.isLost).length;
  const displaySlots = Math.max(ctrl.window.cwnd, 8);
  const slotW = Math.max(8, Math.min(18, (120 - 3 * (displaySlots - 1)) / displaySlots));

  return (
    <Page>
      <Header title="TCP 拥塞控制" />
      <Main>
        {/* ── 左侧控制 ── */}
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn $v="accent" onClick={ctrl.performFullDemo} disabled={ctrl.isPlaying}>⚡ 完整演示</Btn>
            <Btn $v="primary" onClick={ctrl.performSlowStart} disabled={ctrl.isPlaying}>慢启动</Btn>
            <ToggleRow>丢包模拟 <Toggle $on={ctrl.packetLossEnabled} onClick={ctrl.togglePacketLoss} /></ToggleRow>
            <ToggleRow>选择确认 SACK <Toggle $on={ctrl.sackEnabled} onClick={ctrl.toggleSack} /></ToggleRow>
            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted }}>丢包率</div>
            <CompactGrid>
              {[0, 0.05, 0.1, 0.2].map(rate => (
                <MiniBtn
                  key={rate}
                  $a={ctrl.lossRate === rate}
                  onClick={() => ctrl.setLossRate(rate)}
                  disabled={ctrl.isPlaying}
                >
                  {Math.round(rate * 100)}%
                </MiniBtn>
              ))}
            </CompactGrid>
            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted }}>指定丢包序号（可填多个，如 8,12）</div>
            <NumberInput
              type="text"
              placeholder="8,12"
              value={ctrl.dropSeqs.join(',')}
              disabled={ctrl.isPlaying}
              onChange={event => {
                const seqs = event.target.value
                  .split(/[^\d]+/)
                  .map(Number)
                  .filter(seq => Number.isFinite(seq) && seq > 0);
                ctrl.setDropSeqs([...new Set(seqs)]);
              }}
            />
            <MiniBtn
              onClick={() => {
                if (!ctrl.packetLossEnabled) ctrl.togglePacketLoss();
                ctrl.setDropSeqs([...new Set([...ctrl.dropSeqs, ctrl.window.nextSeq])]);
              }}
              disabled={ctrl.isPlaying}
            >
              丢掉 #{ctrl.window.nextSeq}
            </MiniBtn>
            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted }}>速度</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0.5, 1, 2, 3].map(s => <SpeedBtn key={s} $a={speed === s} onClick={() => setSpeed(s)}>{s}x</SpeedBtn>)}
            </div>
            {ctrl.animationStatus && <Status>{ctrl.animationStatus}</Status>}
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={ctrl.togglePause} disabled={!ctrl.isPlaying} style={{ flex: 1 }}>
                {ctrl.isPaused ? '▶ 继续' : '⏸ 暂停'}
              </Btn>
              <Btn onClick={ctrl.stepCycle} disabled={!ctrl.isPaused} style={{ flex: 1 }}>
                ⏭ 单步
              </Btn>
            </div>
            <Btn onClick={ctrl.resetAll} disabled={false} style={{ background: ctrl.isPlaying ? darkTheme.colors.error : undefined, color: ctrl.isPlaying ? '#fff' : undefined, border: ctrl.isPlaying ? 'none' : undefined }}>
              {ctrl.isPlaying ? '⏹ 终止' : '重置'}
            </Btn>
          </PanelC>
        </Panel>

        {/* ── 中间画布 ── */}
        <AnimationCanvas
          flightBalls={ctrl.flightBalls}
          progressMap={ctrl.progressMap}
          phase={ctrl.phase}
          rttCount={ctrl.rttCount}
          cwnd={ctrl.window.cwnd}
          ssthresh={ctrl.window.ssthresh}
          ackedPackets={ctrl.ackedPackets}
          isPlaying={ctrl.isPlaying}
        />

        {/* ── 右侧统计 ── */}
        <Panel>
          <PanelH>📊 统计</PanelH>
          <PanelC>
            <div style={{ fontSize: 11, color: darkTheme.colors.textMuted }}>
              阶段: <span style={{ color: darkTheme.colors.primary }}>{phaseLabel(ctrl.phase)}</span>
            </div>
            <StatRow>RTT 轮次 <span>{ctrl.rttCount}</span></StatRow>
            <StatRow>cwnd <span>{ctrl.window.cwnd} MSS</span></StatRow>
            <StatRow>ssthresh <span>{ctrl.window.ssthresh} MSS</span></StatRow>
            <StatRow>飞行中 <span>{inFlight}</span></StatRow>
            <StatRow>已确认 <span>{ctrl.ackedPackets}</span></StatRow>
            <StatRow>已丢包 <span style={{ color: darkTheme.colors.error }}>{ctrl.lostPackets}</span></StatRow>

            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted, marginTop: 4 }}>发送窗口</div>
            <WindowGrid>
              {Array.from({ length: displaySlots }, (_, i) => {
                const s = i < ctrl.ackedPackets % displaySlots ? 'acked'
                  : i < (ctrl.ackedPackets % displaySlots) + inFlight ? 'sent'
                  : 'free';
                return <WinSlot key={i} $s={s} $w={slotW} />;
              })}
            </WindowGrid>

            <StatRow>重复 ACK <span style={{ color: darkTheme.colors.warning }}>{ctrl.duplicateAcks}</span></StatRow>
            <StatRow>快重传 <span style={{ color: darkTheme.colors.secondaryLight }}>{ctrl.fastRetransmits}</span></StatRow>
            <StatRow>部分 ACK <span style={{ color: darkTheme.colors.accent }}>{ctrl.partialAcks}</span></StatRow>
            <StatRow>RTO 超时 <span style={{ color: darkTheme.colors.warning }}>{ctrl.timeoutCount}</span></StatRow>
            <StatRow>重传次数 <span>{ctrl.retransmissionCount}</span></StatRow>

            <CwndChart history={ctrl.cwndHistory} />

            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted }}>📋 事件日志</div>
            <LogArea ref={logAreaRef}>
              {ctrl.eventLog.map(e => <LogLine key={e.id} $type={e.type}>{e.text}</LogLine>)}
            </LogArea>
          </PanelC>
        </Panel>
      </Main>
    </Page>
  );
};

export default CongestionVisualizer;
