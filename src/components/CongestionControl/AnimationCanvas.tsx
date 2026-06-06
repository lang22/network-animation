import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { FlightBall } from '@/types/congestionTypes';
import FlyingBall from './FlyingBall';

const CanvasPanel = styled.div`
  background: ${darkTheme.colors.surface}; border-radius: 12px;
  border: 1px solid ${darkTheme.colors.border};
  position: relative; overflow: hidden;
`;
const Canvas = styled.div`
  position: absolute; inset: 0;
  background: linear-gradient(180deg, ${darkTheme.colors.background}, ${darkTheme.colors.surface});
`;

const EndpointBox = styled.div<{ $type: 'sender' | 'receiver' }>`
  position: absolute; top: 16px; bottom: 16px; width: 130px;
  ${({ $type }) => $type === 'sender' ? 'left: 16px;' : 'right: 16px;'}
  border-radius: 14px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  padding: 20px 12px; color: white;
  background: linear-gradient(180deg,
    ${({ $type }) => $type === 'sender' ? '#1e40af' : '#166534'} 0%,
    ${({ $type }) => $type === 'sender' ? '#1e3a8a' : '#14532d'} 100%);
  border: 1px solid rgba(255,255,255,0.15);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
`;
const EpTitle = styled.div` font-size: 16px; font-weight: 700; `;
const EpLabel = styled.div`
  font-size: 11px; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px;
  font-family: 'JetBrains Mono', monospace;
`;
const EpValue = styled.div<{ $v?: 'cwnd' | 'other' }>`
  font-size: ${({ $v }) => $v === 'cwnd' ? '28px' : '16px'}; font-weight: 800;
  color: ${({ $v }) => $v === 'cwnd' ? darkTheme.colors.primary : darkTheme.colors.success};
  text-shadow: ${({ $v }) => $v === 'cwnd' ? `0 0 12px ${darkTheme.colors.glow}` : `0 0 8px ${darkTheme.colors.success}`};
  font-family: 'JetBrains Mono', monospace;
`;

const phasePulse = keyframes`
  0%,100% { opacity: 1; } 50% { opacity: 0.7; }
`;
const PhaseBadge = styled.div<{ $phase: string }>`
  position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
  padding: 8px 20px; border-radius: 20px;
  font-size: 14px; font-weight: 700; letter-spacing: 1px;
  z-index: 15; pointer-events: none;
  animation: ${phasePulse} 2s ease-in-out infinite;
  ${({ $phase }) => {
    if ($phase === 'slow_start') return css` background: rgba(34,197,94,0.15); color: #4ade80; border:1px solid rgba(34,197,94,0.4); `;
    if ($phase === 'congestion_avoidance') return css` background: rgba(59,130,246,0.15); color: #60a5fa; border:1px solid rgba(59,130,246,0.4); `;
    if ($phase === 'fast_recovery' || $phase === 'timeout') return css` background: rgba(239,68,68,0.15); color: #f87171; border:1px solid rgba(239,68,68,0.4); `;
    return css` background: rgba(255,255,255,0.05); color: ${darkTheme.colors.textMuted}; `;
  }}
`;

const rttPulse = keyframes`
  0% { transform: translate(-50%,-50%) scale(1); }
  50% { transform: translate(-50%,-50%) scale(1.3); }
  100% { transform: translate(-50%,-50%) scale(1); }
`;
const RttIndicator = styled.div`
  position: absolute; top: 18px; right: 160px;
  font-family: 'JetBrains Mono', monospace; font-weight: 700;
  color: ${darkTheme.colors.primary}; font-size: 14px;
  z-index: 15; pointer-events: none;
  text-shadow: 0 0 8px ${darkTheme.colors.glow};
`;
const RttPulseRing = styled.div<{ $key: number }>`
  position: absolute; top: 26px; right: 168px;
  width: 8px; height: 8px; border-radius: 50%;
  background: ${darkTheme.colors.primary};
  box-shadow: 0 0 10px ${darkTheme.colors.glow};
  z-index: 15; pointer-events: none;
  animation: ${rttPulse} 0.5s ease-out;
`;

const ThermBar = styled.div`
  position: absolute; top: 80px; left: 8px; bottom: 100px;
  width: 16px; background: rgba(0,0,0,0.3); border-radius: 8px;
  border: 1px solid ${darkTheme.colors.border}; z-index: 12; overflow: hidden;
  pointer-events: none;
`;
const ThermFill = styled.div<{ $h: number }>`
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(0deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondaryLight});
  height: ${({ $h }) => $h}%; transition: height 0.5s ease;
  min-height: 4px; border-radius: 0 0 8px 8px; box-shadow: 0 0 8px ${darkTheme.colors.glow};
`;
const ThermThresh = styled.div<{ $th: number }>`
  position: absolute; left: 0; right: 0; bottom: ${({ $th }) => $th}%;
  height: 1px; background: ${darkTheme.colors.warning}; opacity: 0.6; z-index: 1;
  &::after {
    content: 'ssthresh'; position: absolute; left: 20px; top: -6px;
    font-size: 7px; color: ${darkTheme.colors.warning}; white-space: nowrap;
  }
`;

const ChannelLine = styled.div`
  position: absolute; top: 50%; left: 162px; right: 162px;
  height: 1px; background: ${darkTheme.colors.border}; opacity: 0.3;
`;
const ChannelLabel = styled.div`
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: ${darkTheme.colors.textMuted};
  padding: 4px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;
`;

const phaseLabel = (p: string) => {
  if (p === 'slow_start') return '🚀 慢启动';
  if (p === 'congestion_avoidance') return '🔵 拥塞避免';
  if (p === 'fast_recovery') return '🔴 快速恢复';
  if (p === 'timeout') return '⏱ 超时';
  return p;
};

interface AnimationCanvasProps {
  flightBalls: FlightBall[];
  progressMap: Record<string, number>;
  phase: string;
  rttCount: number;
  cwnd: number;
  ssthresh: number;
  ackedPackets: number;
  isPlaying: boolean;
}

const AnimationCanvas: React.FC<AnimationCanvasProps> = React.memo(({
  flightBalls, progressMap, phase, rttCount, cwnd, ssthresh, ackedPackets, isPlaying,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setCw({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el); setCw({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const getBallPos = (ball: { trackY: number; isAck: boolean; id: string }) => {
    const pad = 16; const epW = 130;
    const senderX = pad + epW; const receiverX = cw.w - pad - epW;
    const progress = progressMap[ball.id] ?? 0;
    const y = pad + ((cw.h - pad * 2) * ball.trackY) / 100;
    const x = ball.isAck ? receiverX - (receiverX - senderX) * progress : senderX + (receiverX - senderX) * progress;
    return { x, y };
  };

  const inFlight = flightBalls.filter(b => !b.isAck && !b.isLost).length;
  const maxCwnd = Math.max(cwnd, ssthresh, 16);
  const thermH = Math.min((cwnd / maxCwnd) * 100, 100);
  const thermTh = Math.min((ssthresh / maxCwnd) * 100, 100);

  return (
    <CanvasPanel ref={canvasRef}>
      <Canvas>
        <PhaseBadge $phase={phase}>{phaseLabel(phase)}</PhaseBadge>
        <RttIndicator>RTT #{rttCount}</RttIndicator>
        <RttPulseRing key={rttCount} $key={rttCount} />
        <ThermBar>
          <ThermFill $h={thermH} />
          <ThermThresh $th={thermTh} />
        </ThermBar>

        <EndpointBox $type="sender">
          <EpTitle>📤 发送方</EpTitle>
          <EpLabel>cwnd</EpLabel>
          <EpValue $v="cwnd">{cwnd}</EpValue>
          <EpLabel>ssthresh</EpLabel>
          <EpValue $v="other">{ssthresh}</EpValue>
        </EndpointBox>

        <EndpointBox $type="receiver">
          <EpTitle>📥 接收方</EpTitle>
          <EpLabel>飞行中 / 已收</EpLabel>
          <EpValue $v="cwnd">{inFlight}</EpValue>
          <EpValue $v="other">{ackedPackets}</EpValue>
        </EndpointBox>

        <ChannelLine />
        <ChannelLabel>{isPlaying ? '● 传输中' : 'TCP 拥塞控制通道'}</ChannelLabel>

        {flightBalls.map(ball => {
          const { x, y } = getBallPos(ball);
          return <FlyingBall key={ball.id} x={x} y={y} isAck={ball.isAck} isLost={ball.isLost} seqNum={ball.seqNum} />;
        })}
      </Canvas>
    </CanvasPanel>
  );
});

export default AnimationCanvas;
