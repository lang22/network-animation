import React from 'react';
import styled, { keyframes, css } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { PacketType } from '@/styles/theme';
import { PACKET_SIZE } from '@/utils/constants';

// ==================== 关键帧动画 ====================
const packetAppear = keyframes`
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.08); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
`;

const packetDisappear = keyframes`
    0%   { transform: scale(1); opacity: 1; filter: blur(0); }
    100% { transform: scale(0.2); opacity: 0; filter: blur(4px); }
`;

// ==================== 包装器 ====================
const PacketWrapper = styled.div<{
    $x: number;
    $y: number;
    $packetType: PacketType;
    $direction: 'right' | 'left';
    $selected?: boolean;
    $disappearing?: boolean;
    $moving?: boolean;
}>`
    position: absolute;
    left: ${({ $x }) => $x}px;
    top: ${({ $y }) => $y}px;
    transform: translate(-50%, -50%);
    z-index: ${({ $selected }) => $selected ? 25 : 20};
    pointer-events: auto;
    cursor: pointer;

    /* 选中时外层发光 */
    ${({ $selected, $packetType }) => $selected && css`
        filter: drop-shadow(0 0 8px ${darkTheme.packetColors[$packetType]?.glow || 'rgba(255,255,255,0.6)'})
                drop-shadow(0 0 16px ${darkTheme.packetColors[$packetType]?.glow || 'rgba(255,255,255,0.3)'});
    `}
`;

// ==================== 拖尾 ====================
const TrailLine = styled.div<{ $direction: 'right' | 'left'; $color: string; $moving?: boolean }>`
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 45px;
    height: 3px;
    border-radius: 2px;
    pointer-events: none;
    opacity: ${({ $moving }) => $moving ? 0.7 : 0};
    transition: opacity 0.2s;

    /* 向右飞行: 拖尾在左侧 */
    ${({ $direction, $color }) => $direction === 'right' && css`
        right: calc(100% + 2px);
        background: linear-gradient(to left, ${$color}cc, ${$color}44 40%, transparent 100%);
    `}

    /* 向左飞行: 拖尾在右侧 */
    ${({ $direction, $color }) => $direction === 'left' && css`
        left: calc(100% + 2px);
        background: linear-gradient(to right, ${$color}cc, ${$color}44 40%, transparent 100%);
    `}
`;

// ==================== 包体 ====================
const PacketBody = styled.div<{
    $packetType: PacketType;
    $direction: 'right' | 'left';
    $selected?: boolean;
    $disappearing?: boolean;
}>`
    min-width: ${PACKET_SIZE.WIDTH}px;
    padding: 8px 12px;
    border-radius: 6px;
    background: linear-gradient(
        135deg,
        ${({ $packetType }) => darkTheme.packetColors[$packetType]?.from || darkTheme.colors.accent} 0%,
        ${({ $packetType }) => darkTheme.packetColors[$packetType]?.to || darkTheme.colors.accent} 100%
    );
    color: ${({ $packetType }) => darkTheme.packetColors[$packetType]?.text || '#fff'};
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.3),
        0 0 15px ${({ $packetType }) => darkTheme.packetColors[$packetType]?.glow || 'transparent'};
    position: relative;
    white-space: nowrap;
    transition: box-shadow 0.2s;

    /* 出现动画 - 组件挂载时播放 */
    animation: ${packetAppear} 0.3s ease-out;

    /* 消失动画 - 到达后触发 */
    ${({ $disappearing }) => $disappearing && css`
        animation: ${packetDisappear} 0.4s ease-in 0.15s forwards;
        pointer-events: none;
    `}

    /* 选中时边框发光 */
    ${({ $selected, $packetType }) => $selected && css`
        outline: 2px solid rgba(255,255,255,0.6);
        outline-offset: 2px;
        box-shadow:
            0 2px 8px rgba(0, 0, 0, 0.3),
            0 0 20px ${darkTheme.packetColors[$packetType]?.glow || 'transparent'},
            0 0 35px ${darkTheme.packetColors[$packetType]?.glow || 'transparent'};
    `}

    &::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 8px;
        background: linear-gradient(
            135deg,
            ${({ $packetType }) => darkTheme.packetColors[$packetType]?.from || darkTheme.colors.accent} 0%,
            ${({ $packetType }) => darkTheme.packetColors[$packetType]?.to || darkTheme.colors.accent} 100%
        );
        opacity: 0.3;
        filter: blur(6px);
        z-index: -1;
    }

    &::after {
        content: '';
        position: absolute;
        top: 50%;
        ${({ $direction }) => $direction === 'right' ? 'right: -6px;' : 'left: -6px;'}
        transform: translateY(-50%) ${({ $direction }) => $direction === 'left' ? 'rotate(180deg)' : ''};
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 8px solid ${({ $packetType }) => darkTheme.packetColors[$packetType]?.to || darkTheme.colors.accent};
    }
`;

// ==================== 内部信息 ====================
const PacketInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const PacketLabel = styled.div`
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.5px;
`;

const InfoRow = styled.div`
    display: flex;
    gap: 6px;
    font-size: 9px;
    font-weight: 500;
    opacity: 0.85;
`;

// ==================== Props ====================
interface PacketProps {
    x: number;
    y: number;
    type: PacketType;
    moving?: boolean;
    onClick?: () => void;
    seqNum?: number;
    ackNum?: number;
    direction?: 'right' | 'left';
    selected?: boolean;
    disappearing?: boolean;
}

const Packet: React.FC<PacketProps> = ({
    x,
    y,
    type,
    moving = false,
    onClick,
    seqNum,
    ackNum,
    direction = 'right',
    selected = false,
    disappearing = false,
}) => {
    const hasSeqOrAck = seqNum !== undefined || ackNum !== undefined;

    const trailColor = darkTheme.packetColors[type]?.to || darkTheme.colors.accent;

    return (
        <PacketWrapper
            $x={x}
            $y={y}
            $packetType={type}
            $direction={direction}
            $selected={selected}
            $disappearing={disappearing}
            $moving={moving}
            onClick={onClick}
        >
            <PacketBody
                $packetType={type}
                $direction={direction}
                $selected={selected}
                $disappearing={disappearing}
            >
                <TrailLine
                    $direction={direction}
                    $color={trailColor}
                    $moving={moving}
                />
                <PacketInfo>
                    <PacketLabel>{type}</PacketLabel>
                    {hasSeqOrAck && (
                        <InfoRow>
                            {seqNum !== undefined && <span>SEQ: {seqNum}</span>}
                            {ackNum !== undefined && <span>ACK: {ackNum}</span>}
                        </InfoRow>
                    )}
                </PacketInfo>
            </PacketBody>
        </PacketWrapper>
    );
};

export default Packet;
