import React from 'react';
import styled, { keyframes } from 'styled-components';

const ballAppear = keyframes`
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  60%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
`;

// 数据包球体 — GPU加速，纯色无光晕，白色粗字
const BallWrapper = styled.div<{ $x: number; $y: number; $retransmission?: boolean }>`
  position: absolute;
  left: ${({ $x }) => $x}px; top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px;
  border-radius: 50%;
  background: ${({ $retransmission }) => $retransmission
    ? 'linear-gradient(135deg, #38bdf8, #0ea5e9 50%, #0369a1)'
    : 'linear-gradient(135deg, #fbbf24, #f59e0b 50%, #d97706)'};
  border: 2px solid rgba(255,255,255,0.35);
  box-shadow: ${({ $retransmission }) => $retransmission
    ? '0 0 12px rgba(56,189,248,0.45), 0 2px 6px rgba(0,0,0,0.35)'
    : '0 2px 6px rgba(0,0,0,0.35)'};
  z-index: 20;
  pointer-events: none;
  will-change: left, top;
  display: flex; align-items: center; justify-content: center;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: calc(100% - 2px);
    transform: translateY(-50%);
    width: 40px; height: 2px;
    background: ${({ $retransmission }) => $retransmission
      ? 'linear-gradient(to right, rgba(56,189,248,0.45), transparent)'
      : 'linear-gradient(to right, rgba(245,158,11,0.4), transparent)'};
    border-radius: 1px;
  }
`;

// ACK 回程球体
const AckBall = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  left: ${({ $x }) => $x}px; top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  width: 32px; height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #7c3aed 50%, #6d28d9);
  border: 2px solid rgba(255,255,255,0.35);
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  z-index: 21;
  pointer-events: none;
  will-change: left, top;
  display: flex; align-items: center; justify-content: center;

  &::after {
    content: '✓';
    color: white; font-size: 14px; font-weight: 900;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    right: calc(100% - 2px);
    transform: translateY(-50%);
    width: 30px; height: 2px;
    background: linear-gradient(to left, rgba(124,58,237,0.4), transparent);
    border-radius: 1px;
  }
`;

const SeqLabel = styled.span`
  font-size: 11px; font-weight: 900;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
  pointer-events: none;
  font-family: 'JetBrains Mono', monospace;
  z-index: 1;
  line-height: 1;
`;

const LostBall = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  left: ${({ $x }) => $x}px; top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, #f87171, #ef4444 50%, #dc2626);
  border: 2px solid rgba(255,255,255,0.35);
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  z-index: 22;
  pointer-events: none;
  animation: ${ballAppear} 0.3s ease-out;
  display: flex; align-items: center; justify-content: center;
  &::after { content: '✕'; color: white; font-size: 20px; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,0.4); }
`;

// 重复 ACK：同一个 ACK 号反复回送，用虚线琥珀色区分
const DupAckBall = styled.div<{ $x: number; $y: number }>`
  position: absolute;
  left: ${({ $x }) => $x}px; top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  width: 28px; height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fbbf24, #f59e0b 60%, #b45309);
  border: 2px dashed rgba(255,255,255,0.7);
  box-shadow: 0 0 8px rgba(245,158,11,0.45);
  z-index: 21;
  pointer-events: none;
  will-change: left, top;
  display: flex; align-items: center; justify-content: center;

  &::after {
    content: '↺';
    color: white; font-size: 14px; font-weight: 900;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }
`;

interface FlyingBallProps {
  x: number; y: number;
  isAck: boolean;
  isLost?: boolean;
  isRetransmission?: boolean;
  isDuplicateAck?: boolean;
  seqNum?: number;
}

const FlyingBall: React.FC<FlyingBallProps> = React.memo(({
  x, y, isAck, isLost, isRetransmission, isDuplicateAck, seqNum,
}) => {
  if (isLost) return <LostBall $x={x} $y={y} />;

  if (isAck) return isDuplicateAck
    ? <DupAckBall $x={x} $y={y} />
    : <AckBall $x={x} $y={y} />;

  return (
    <BallWrapper $x={x} $y={y} $retransmission={isRetransmission}>
      {seqNum !== undefined && <SeqLabel>{isRetransmission ? `RTX ${seqNum}` : `#${seqNum}`}</SeqLabel>}
    </BallWrapper>
  );
});

export default FlyingBall;
