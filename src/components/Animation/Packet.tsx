import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { PacketType } from '@/styles/theme';
import { PACKET_SIZE } from '@/utils/constants';

const PacketWrapper = styled.div<{
    $x: number;
    $y: number;
    $packetType: PacketType;
    $moving: boolean;
    $direction: 'right' | 'left';
}>`
    position: absolute;
    /* 使用中心点定位 */
    left: ${({ $x }) => $x}px;
    top: ${({ $y }) => $y}px;
    transform: translate(-50%, -50%);
    z-index: 20;
    pointer-events: ${({ $moving }) => $moving ? 'none' : 'auto'};
    cursor: pointer;
`;

const PacketBody = styled.div<{ $packetType: PacketType; $direction: 'right' | 'left' }>`
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

    /* 箭头方向 */
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

interface PacketProps {
    x: number;
    y: number;
    type: PacketType;
    moving?: boolean;
    onClick?: () => void;
    seqNum?: number;
    ackNum?: number;
    direction?: 'right' | 'left';
}

const Packet: React.FC<PacketProps> = ({
    x,
    y,
    type,
    moving = false,
    onClick,
    seqNum,
    ackNum,
    direction = 'right'
}) => {
    const hasSeqOrAck = seqNum !== undefined || ackNum !== undefined;

    return (
        <PacketWrapper
            $x={x}
            $y={y}
            $packetType={type}
            $moving={moving}
            $direction={direction}
            onClick={moving ? undefined : onClick}
        >
            <PacketBody $packetType={type} $direction={direction}>
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