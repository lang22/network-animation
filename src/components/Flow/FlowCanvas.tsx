import React from 'react';
import styled, { keyframes } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { FlowNode, FlowPacket } from '@/types/flowTypes';

const CanvasPanel = styled.div`
  position: relative; overflow: hidden;
  background: ${darkTheme.colors.surface}; border-radius: 12px;
  border: 1px solid ${darkTheme.colors.border};
  background-image:
    radial-gradient(circle at 20% 30%, rgba(0,212,255,0.06), transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(124,58,237,0.06), transparent 40%);
`;

const NodeBox = styled.div<{ $tone: FlowNode['tone']; $active: boolean }>`
  position: absolute; transform: translate(-50%, -50%);
  width: 132px; padding: 12px 10px; border-radius: 12px;
  text-align: center; color: #fff; z-index: 10;
  border: 1px solid ${({ $active }) => $active ? darkTheme.colors.primary : 'rgba(255,255,255,0.14)'};
  box-shadow: ${({ $active }) => $active ? `0 0 18px ${darkTheme.colors.glow}` : '0 4px 14px rgba(0,0,0,0.35)'};
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
  background: linear-gradient(180deg,
    ${({ $tone }) => $tone === 'client' ? '#166534' : $tone === 'infra' ? '#4c1d95' : '#1e3a8a'} 0%,
    ${({ $tone }) => $tone === 'client' ? '#14532d' : $tone === 'infra' ? '#2e1065' : '#172554'} 100%);
`;

const NodeLabel = styled.div` font-size: 13px; font-weight: 700; line-height: 1.3; `;
const NodeDetail = styled.div`
  margin-top: 6px; font-size: 10px; opacity: 0.6; line-height: 1.5;
  font-family: 'JetBrains Mono', monospace;
`;

const pulse = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.06); }
`;
const PacketPill = styled.div<{ $x: number; $y: number }>`
  position: absolute; left: ${({ $x }) => $x}%; top: ${({ $y }) => $y}%;
  transform: translate(-50%, -50%);
  padding: 7px 12px; border-radius: 16px; z-index: 20;
  font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700;
  color: #fff; white-space: nowrap;
  background: linear-gradient(135deg, #38bdf8, #0284c7);
  box-shadow: 0 0 16px rgba(56,189,248,0.45);
  animation: ${pulse} 1.2s ease-in-out infinite;
`;

const Legend = styled.div`
  position: absolute; left: 16px; bottom: 12px; display: flex; gap: 14px;
  font-size: 10px; color: ${darkTheme.colors.textMuted};
  span::before {
    content: ''; display: inline-block; width: 8px; height: 8px;
    border-radius: 50%; margin-right: 5px; vertical-align: middle;
    background: currentColor;
  }
  .client { color: #4ade80; }
  .server { color: #60a5fa; }
  .infra { color: #c4b5fd; }
`;

interface FlowCanvasProps {
  nodes: FlowNode[];
  packet: FlowPacket | null;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({ nodes, packet }) => {
  const from = packet ? nodes.find(node => node.id === packet.step.from) : undefined;
  const to = packet ? nodes.find(node => node.id === packet.step.to) : undefined;

  const activeIds = new Set<string>();
  if (from) activeIds.add(from.id);
  if (to) activeIds.add(to.id);

  const packetX = from && to ? from.x + (to.x - from.x) * (packet?.progress ?? 0) : 0;
  const packetY = from && to ? from.y + (to.y - from.y) * (packet?.progress ?? 0) : 0;

  return (
    <CanvasPanel data-testid="flow-canvas">
      {nodes.map(node => (
        <NodeBox
          key={node.id}
          $tone={node.tone}
          $active={activeIds.has(node.id)}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <NodeLabel>{node.label}</NodeLabel>
          {node.detail && <NodeDetail>{node.detail}</NodeDetail>}
        </NodeBox>
      ))}

      {from && to && packet && (
        <PacketPill $x={packetX} $y={packetY}>{packet.step.label}</PacketPill>
      )}

      <Legend>
        <span className="client">客户端 / 主机</span>
        <span className="server">服务器</span>
        <span className="infra">基础设施</span>
      </Legend>
    </CanvasPanel>
  );
};

export default FlowCanvas;
