import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { PacketType } from '@/styles/theme';

const PacketWrapper = styled.div<{
    $x: number;
    $y: number;
    $packetType: PacketType;
    $moving: boolean;
}>`
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(${({ $x }) => $x}px, ${({ $y }) => $y}px);
    transition: ${({ $moving }) => $moving ? 'transform 0.8s ease-in-out' : 'none'};
    z-index: 20;
    pointer-events: ${({ $moving }) => $moving ? 'none' : 'auto'};
    cursor: pointer;
`;

const PacketBody = styled.div<{ $packetType: PacketType }>`
    min-width: 70px;
    padding: 8px 12px;
    border-radius: 8px;
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
        0 4px 15px rgba(0, 0, 0, 0.3),
        0 0 20px ${({ $packetType }) => darkTheme.packetColors[$packetType]?.glow || 'transparent'};
    position: relative;
    white-space: nowrap;

    &::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 10px;
        background: linear-gradient(
            135deg,
            ${({ $packetType }) => darkTheme.packetColors[$packetType]?.from || darkTheme.colors.accent} 0%,
            ${({ $packetType }) => darkTheme.packetColors[$packetType]?.to || darkTheme.colors.accent} 100%
        );
        opacity: 0.3;
        filter: blur(8px);
        z-index: -1;
    }

    &::after {
        content: '';
        position: absolute;
        top: 50%;
        right: -6px;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-top: 6px solid transparent;
        border-bottom: 6px solid transparent;
        border-left: 8px solid ${({ $packetType }) => darkTheme.packetColors[$packetType]?.to || darkTheme.colors.accent};
    }
`;

const PacketLabel = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
`;

interface PacketProps {
    x: number;
    y: number;
    type: PacketType;
    moving?: boolean;
    onClick?: () => void;
    seqNum?: number;
    ackNum?: number;
}

const Packet: React.FC<PacketProps> = ({
    x,
    y,
    type,
    moving = false,
    onClick,
    seqNum,
    ackNum
}) => {
    return (
        <PacketWrapper
            $x={x}
            $y={y}
            $packetType={type}
            $moving={moving}
            onClick={moving ? undefined : onClick}
        >
            <PacketBody $packetType={type}>
                <PacketLabel>
                    {type}
                    {seqNum !== undefined && (
                        <span style={{ opacity: 0.7, fontSize: '9px' }}>
                            SEQ:{seqNum}
                        </span>
                    )}
                </PacketLabel>
            </PacketBody>
        </PacketWrapper>
    );
};

export default Packet;