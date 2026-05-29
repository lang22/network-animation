import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { useCongestionControl } from '@/hooks/useCongestionControl';
import FlyingBall from './FlyingBall';
import SenderWindow from './SenderWindow';
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
`;

const Panel = styled.div`
  background: ${darkTheme.colors.surface};
  border-radius: 12px; border: 1px solid ${darkTheme.colors.border};
  display: flex; flex-direction: column; overflow: hidden;
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

const CanvasPanel = styled.div`
  background: ${darkTheme.colors.surface};
  border-radius: 12px; border: 1px solid ${darkTheme.colors.border};
  position: relative; overflow: hidden;
`;

const Canvas = styled.div`
  position: absolute; inset: 0;
  background: linear-gradient(180deg, ${darkTheme.colors.background}, ${darkTheme.colors.surface});
`;

// ==================== 端点盒子 ====================
const EndpointBox = styled.div<{ $type: 'sender' | 'receiver'; $active?: boolean }>`
  position: absolute;
  top: 16px; bottom: 16px; width: 100px;
  ${({ $type }) => $type === 'sender' ? 'left: 16px;' : 'right: 16px;'}
  border-radius: 12px; display: flex; flex-direction: column;
  align-items: center; padding: 16px 8px; color: white;
  background: linear-gradient(180deg,
    ${({ $type }) => $type === 'sender' ? '#1e40af' : '#166534'} 0%,
    ${({ $type }) => $type === 'sender' ? '#1e3a8a' : '#14532d'} 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
`;

const EpTitle = styled.div`
  font-size: 12px; font-weight: 700; margin-bottom: 4px;
`;

const EpInfo = styled.div`
  font-size: 9px; opacity: 0.6; margin-top: 6px;
  text-align: center; font-family: 'JetBrains Mono', monospace;
  span { color: ${darkTheme.colors.primary}; font-weight: 600; }
`;

// ==================== 通道区域 ====================
const ChannelLine = styled.div`
  position: absolute; top: 50%; left: 132px; right: 132px;
  height: 1px; background: ${darkTheme.colors.border}; opacity: 0.3;
`;

const ChannelLabel = styled.div`
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: ${darkTheme.colors.textMuted};
  padding: 4px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;
`;

// ==================== 按钮 ====================
const Btn = styled.button<{ $v?: 'primary' | 'accent' }>`
  width: 100%; padding: 11px 14px; border-radius: 8px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.2s; border: none;
  ${({ $v }) => $v === 'accent' ? `
    background: linear-gradient(90deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondaryLight});
    color: #fff; box-shadow: 0 0 12px ${darkTheme.colors.glow};
  ` : $v === 'primary' ? `
    background: ${darkTheme.colors.primary}; color: #000;
  ` : `
    background: ${darkTheme.colors.surfaceLight};
    color: ${darkTheme.colors.text};
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
    content: ''; position: absolute;
    top: 2px; ${({ $on }) => $on ? 'right: 2px;' : 'left: 2px;'}
    width: 18px; height: 18px; border-radius: 50%;
    background: white; transition: all 0.2s;
  }
`;

const SpeedBtn = styled.button<{ $a?: boolean }>`
  flex: 1; padding: 6px; border-radius: 5px; border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted};
  font-size: 11px; cursor: pointer;
`;

const Status = styled.div`
  padding: 10px; background: rgba(0,212,255,0.08);
  border-left: 3px solid ${darkTheme.colors.primary};
  border-radius: 0 6px 6px 0; font-size: 11px;
  color: ${darkTheme.colors.text};
`;

const StatRow = styled.div`
  display: flex; justify-content: space-between; padding: 6px 0;
  font-size: 11px; color: ${darkTheme.colors.text};
  border-bottom: 1px solid ${darkTheme.colors.border};
  span { color: ${darkTheme.colors.primary}; font-weight: 600; }
`;

// ==================== 主组件 ====================
const CongestionVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const [cw, setCw] = useState({ w: 800, h: 500 });

  const ctrl = useCongestionControl(speed);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCw({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    setCw({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // 计算小球位置
  const getBallPos = (ball: typeof ctrl.flightBalls[0]) => {
    const pad = 16; const epW = 100;
    const senderX = pad + epW;
    const receiverX = cw.w - pad - epW;
    const y = pad + ((cw.h - pad * 2) * ball.trackY) / 100;
    const x = ball.isAck
      ? receiverX - (receiverX - senderX) * ball.progress
      : senderX + (receiverX - senderX) * ball.progress;
    return { x, y };
  };

  const inFlight = ctrl.flightBalls.filter(b => !b.isAck && !b.isLost).length;

  return (
    <Page>
      {/* Header - reuse existing */}
      <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${darkTheme.colors.border}` }}>
        <span style={{ color: darkTheme.colors.primary, fontWeight: 700 }}>Network Simulator</span>
        <span style={{ color: darkTheme.colors.textMuted, fontSize: 12, marginLeft: 12 }}>/ 拥塞控制</span>
      </div>

      <Main>
        {/* 左侧 */}
        <Panel>
          <PanelH>🎮 控制</PanelH>
          <PanelC>
            <Btn $v="accent" onClick={ctrl.performFullDemo} disabled={ctrl.isPlaying}>
              ⚡ 完整演示
            </Btn>
            <Btn $v="primary" onClick={ctrl.performSlowStart} disabled={ctrl.isPlaying}>
              慢启动
            </Btn>

            <ToggleRow>
              丢包模拟
              <Toggle $on={ctrl.packetLossEnabled} onClick={ctrl.togglePacketLoss} />
            </ToggleRow>

            <div style={{ fontSize: 10, color: darkTheme.colors.textMuted }}>速度</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0.5, 1, 2, 3].map(s => (
                <SpeedBtn key={s} $a={speed === s} onClick={() => setSpeed(s)}>{s}x</SpeedBtn>
              ))}
            </div>

            {ctrl.animationStatus && <Status>{ctrl.animationStatus}</Status>}

            <Btn onClick={ctrl.resetAll} disabled={ctrl.isPlaying}>重置</Btn>
          </PanelC>
        </Panel>

        {/* 中间画布 */}
        <CanvasPanel ref={canvasRef}>
          <Canvas>
            {/* 发送方 */}
            <EndpointBox $type="sender" $active={ctrl.isPlaying}>
              <EpTitle>📤 发送方</EpTitle>
              <EpInfo>cwnd: <span>{ctrl.window.cwnd}</span></EpInfo>
              <EpInfo>ssthresh: <span>{ctrl.window.ssthresh}</span></EpInfo>
              <EpInfo>seq: <span>{ctrl.window.nextSeq}</span></EpInfo>
            </EndpointBox>

            {/* 接收方 */}
            <EndpointBox $type="receiver" $active={ctrl.isPlaying}>
              <EpTitle>📥 接收方</EpTitle>
              <EpInfo>窗口: <span>64</span></EpInfo>
              <EpInfo>已接收: <span>{ctrl.ackedPackets}</span></EpInfo>
            </EndpointBox>

            {/* 通道 */}
            <ChannelLine />
            <ChannelLabel>{ctrl.isPlaying ? '● 传输中' : 'TCP 拥塞控制通道'}</ChannelLabel>

            {/* 飞行小球 */}
            {ctrl.flightBalls.map(ball => {
              const { x, y } = getBallPos(ball);
              return <FlyingBall key={ball.id} x={x} y={y} isAck={ball.isAck} isLost={ball.isLost} />;
            })}
          </Canvas>
        </CanvasPanel>

        {/* 右侧 */}
        <Panel>
          <PanelH>📊 统计</PanelH>
          <PanelC>
            <div style={{ fontSize: 11, color: darkTheme.colors.textMuted, marginBottom: 4 }}>
              阶段: <span style={{ color: darkTheme.colors.primary }}>
                {ctrl.phase === 'slow_start' ? '慢启动' : ctrl.phase === 'congestion_avoidance' ? '拥塞避免' : ctrl.phase === 'fast_recovery' ? '快速恢复' : ctrl.phase}
              </span>
            </div>
            <StatRow><span>RTT 轮次</span> <span>{ctrl.rttCount}</span></StatRow>
            <StatRow><span>cwnd</span> <span>{ctrl.window.cwnd} MSS</span></StatRow>
            <StatRow><span>ssthresh</span> <span>{ctrl.window.ssthresh} MSS</span></StatRow>
            <StatRow><span>飞行中</span> <span>{inFlight}</span></StatRow>
            <StatRow><span>已确认</span> <span>{ctrl.ackedPackets}</span></StatRow>
            <StatRow><span>已丢包</span> <span style={{ color: darkTheme.colors.error }}>{ctrl.lostPackets}</span></StatRow>

            <SenderWindow
              cwnd={ctrl.window.cwnd}
              inFlight={inFlight}
              acked={ctrl.ackedPackets}
            />
            <CwndChart history={ctrl.cwndHistory} />
          </PanelC>
        </Panel>
      </Main>
    </Page>
  );
};

export default CongestionVisualizer;
