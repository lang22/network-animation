import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { CwndRecord } from '@/types/congestionTypes';

const ChartBox = styled.div`
  width: 100%;
  padding: 10px;
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  border: 1px solid ${darkTheme.colors.border};
`;

const ChartLabel = styled.div`
  font-size: 10px;
  color: ${darkTheme.colors.textMuted};
  margin-bottom: 6px;
  text-align: center;
`;

const SvgContainer = styled.svg`
  width: 100%;
  height: 80px;
  display: block;
`;

interface CwndChartProps {
  history: CwndRecord[];
}

const MAX_CWND_CHART = 128;

const CwndChart: React.FC<CwndChartProps> = ({ history }) => {
  if (history.length < 2) {
    return (
      <ChartBox>
        <ChartLabel>📊 拥塞窗口变化</ChartLabel>
        <div style={{ textAlign: 'center', fontSize: '10px', color: darkTheme.colors.textMuted, padding: '10px 0' }}>
          等待数据...
        </div>
      </ChartBox>
    );
  }

  const w = 240;
  const h = 70;
  const pad = 8;
  const maxVal = Math.max(...history.map(p => p.cwnd), 10);

  const points = history.map((p, i) => {
    const x = pad + (i / Math.max(history.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (p.cwnd / maxVal) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  // ssthresh line
  const ssthresh = history[history.length - 1].ssthresh;
  const ssY = h - pad - (ssthresh / maxVal) * (h - pad * 2);

  return (
    <ChartBox>
      <ChartLabel>📊 拥塞窗口 (max: {maxVal} MSS)</ChartLabel>
      <SvgContainer viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* ssthresh 虚线 */}
        <line
          x1={pad} y1={ssY} x2={w - pad} y2={ssY}
          stroke={darkTheme.colors.warning}
          strokeWidth="0.5"
          strokeDasharray="3,3"
          opacity="0.5"
        />
        {/* cwnd 折线 */}
        <polyline
          fill="none"
          stroke={darkTheme.colors.primary}
          strokeWidth="1.5"
          points={points}
          opacity="0.9"
        />
      </SvgContainer>
    </ChartBox>
  );
};

export default CwndChart;
