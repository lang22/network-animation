import React from 'react';
import styled, { keyframes } from 'styled-components';
import { darkTheme } from '@/styles/theme';

const ballAppear = keyframes`
  0%   { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  60%  { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
`;

const BallWrapper = styled.div<{ $x: number; $y: number; $color: string; $isAck: boolean }>`
  position: absolute;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  transform: translate(-50%, -50%);
  width: ${({ $isAck }) => $isAck ? '8px' : '16px'};
  height: ${({ $isAck }) => $isAck ? '8px' : '16px'};
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, rgba(255,255,255,0.8), ${({ $color }) => $color});
  box-shadow:
    0 0 8px ${({ $color }) => $color},
    0 0 16px ${({ $color }) => $color}88;
  z-index: 20;
  pointer-events: none;
  animation: ${ballAppear} 0.25s ease-out;

  /* 拖尾 */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    ${({ $isAck }) => $isAck ? 'right: calc(100% + 2px);' : 'left: calc(100% + 2px);'}
    transform: translateY(-50%);
    width: 30px;
    height: 2px;
    border-radius: 1px;
    background: linear-gradient(
      ${({ $isAck }) => $isAck ? 'to left' : 'to right'},
      ${({ $color }) => $color}cc,
      transparent
    );
    opacity: 0.6;
  }
`;

const LostBall = styled(BallWrapper)`
  background: radial-gradient(circle at 40% 40%, #fff, ${darkTheme.colors.error});
  box-shadow: 0 0 12px ${darkTheme.colors.error};
  &::after { display: none; }
`;

interface FlyingBallProps {
  x: number;
  y: number;
  isAck: boolean;
  isLost?: boolean;
}

const COLORS = ['#38bdf8', '#00d4ff', '#60a5fa', '#818cf8', '#22d3ee', '#93c5fd'];

const FlyingBall: React.FC<FlyingBallProps> = ({ x, y, isAck, isLost }) => {
  const color = COLORS[Math.abs(x * 7 + y * 13) % COLORS.length];

  if (isLost) {
    return <LostBall $x={x} $y={y} $color={darkTheme.colors.error} $isAck={false} />;
  }

  return (
    <BallWrapper
      $x={x}
      $y={y}
      $color={isAck ? darkTheme.colors.success : color}
      $isAck={isAck}
    />
  );
};

export default FlyingBall;
