import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';

const WindowBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  border: 1px solid ${darkTheme.colors.border};
`;

const Label = styled.div`
  font-size: 10px;
  color: ${darkTheme.colors.textMuted};
  text-align: center;
`;

const WindowBar = styled.div`
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: flex-start;
  min-height: 20px;
`;

const WindowSlot = styled.div<{ $filled: boolean; $sent: boolean }>`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: ${({ $filled, $sent }) =>
    $filled ? ($sent ? darkTheme.colors.success : darkTheme.colors.primary)
    : 'transparent'};
  border: 1px solid ${({ $filled, $sent }) =>
    $filled ? 'transparent' : darkTheme.colors.border};
  transition: background 0.3s;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: ${darkTheme.colors.textMuted};
  font-family: 'JetBrains Mono', monospace;
  span { color: ${darkTheme.colors.primary}; font-weight: 600; }
`;

interface SenderWindowProps {
  cwnd: number;
  inFlight: number;
  acked: number;
}

const SenderWindow: React.FC<SenderWindowProps> = ({ cwnd, inFlight, acked }) => {
  const displaySlots = Math.max(cwnd, 4);
  const filled = acked % displaySlots;

  return (
    <WindowBox>
      <Label>📤 发送窗口</Label>
      <InfoRow>cwnd: <span>{cwnd}</span>  MSS</InfoRow>
      <WindowBar>
        {Array.from({ length: displaySlots }, (_, i) => (
          <WindowSlot
            key={i}
            $filled={i < filled}
            $sent={i >= filled && i < filled + inFlight}
          />
        ))}
      </WindowBar>
      <InfoRow>飞行中: <span>{inFlight}</span>  已确认: <span>{acked}</span></InfoRow>
    </WindowBox>
  );
};

export default SenderWindow;
