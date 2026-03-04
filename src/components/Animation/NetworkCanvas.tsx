import React from 'react';
import styled, { keyframes, css } from 'styled-components';
import { darkTheme } from '@/styles/theme';

const pulseGlow = keyframes`
    0%, 100% {
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }
    50% {
        box-shadow: 0 0 40px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3);
    }
`;

const dataFlow = keyframes`
    0% { transform: translateX(-100%); opacity: 0; }
    50% { opacity: 1; }
    100% { transform: translateX(100%); opacity: 0; }
`;

const CanvasContainer = styled.div`
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, ${darkTheme.colors.background} 0%, ${darkTheme.colors.surface} 100%);
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            linear-gradient(90deg, transparent 49.5%, rgba(0, 212, 255, 0.05) 49.5%, rgba(0, 212, 255, 0.05) 50.5%, transparent 50.5%),
            linear-gradient(0deg, transparent 49.5%, rgba(0, 212, 255, 0.05) 49.5%, rgba(0, 212, 255, 0.05) 50.5%, transparent 50.5%);
        background-size: 30px 30px;
        pointer-events: none;
        opacity: 0.6;
    }
`;

const NodeContainer = styled.div<{ $position: 'left' | 'right' }>`
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    ${({ $position }) => $position}: 10%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 10;
`;

const NodeBox = styled.div<{ $active?: boolean; $type: 'client' | 'server' }>`
    width: 80px;
    height: 60px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 12px;
    text-align: center;
    position: relative;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(
        135deg,
        ${({ $type }) => darkTheme.nodeColors[$type].from} 0%,
        ${({ $type }) => darkTheme.nodeColors[$type].to} 100%
    );
    box-shadow:
        0 4px 15px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);

    ${({ $active }) =>
        $active &&
        css`
            animation: ${pulseGlow} 1.5s ease-in-out infinite;
            transform: scale(1.05);
        `}

    &::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: 12px;
        background: linear-gradient(135deg,
            rgba(255,255,255,0.2) 0%,
            transparent 50%,
            rgba(255,255,255,0.1) 100%);
        pointer-events: none;
    }
`;

const NodeLabel = styled.div`
    font-size: 9px;
    opacity: 0.7;
    margin-top: 2px;
    font-weight: 400;
`;

const NodeType = styled.div`
    font-size: 9px;
    opacity: 0.6;
    margin-top: 4px;
    color: ${darkTheme.colors.textMuted};
`;

const ConnectionContainer = styled.div`
    position: absolute;
    top: 50%;
    left: 20%;
    right: 20%;
    height: 60px;
    transform: translateY(-50%);
    z-index: 1;
`;

const ConnectionLine = styled.div<{ $active?: boolean }>`
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ $active }) =>
        $active
            ? `linear-gradient(90deg, ${darkTheme.colors.success}, ${darkTheme.colors.primary}, ${darkTheme.colors.success})`
            : darkTheme.colors.border
    };
    transform: translateY(-50%);
    transition: all 0.4s ease;
    border-radius: 1px;

    &::before, &::after {
        content: '';
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        top: 50%;
        transform: translateY(-50%);
        background: ${darkTheme.colors.primary};
        box-shadow: 0 0 10px ${darkTheme.colors.primary};
        opacity: ${({ $active }) => $active ? 1 : 0};
        transition: opacity 0.3s ease;
    }

    &::before { left: -5px; }
    &::after { right: -5px; }
`;

const DataFlowEffect = styled.div<{ $active?: boolean }>`
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 4px;
    transform: translateY(-50%);
    overflow: hidden;
    opacity: ${({ $active }) => $active ? 1 : 0};
    transition: opacity 0.3s ease;

    &::before {
        content: '';
        position: absolute;
        width: 60px;
        height: 100%;
        background: linear-gradient(90deg, transparent, ${darkTheme.colors.primary}, transparent);
        animation: ${dataFlow} 1.5s linear infinite;
        border-radius: 2px;
    }
`;

const ConnectionLabel = styled.div`
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
    font-size: 10px;
    color: ${darkTheme.colors.textMuted};
    white-space: nowrap;
`;

interface NetworkCanvasProps {
    clientActive: boolean;
    serverActive: boolean;
    connectionActive: boolean;
    children?: React.ReactNode;
}

const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
    clientActive,
    serverActive,
    connectionActive,
    children
}) => {
    return (
        <CanvasContainer>
            <ConnectionContainer>
                <ConnectionLine $active={connectionActive} />
                <DataFlowEffect $active={connectionActive} />
                <ConnectionLabel>TCP Connection</ConnectionLabel>
            </ConnectionContainer>

            <NodeContainer $position="left">
                <NodeBox $active={clientActive} $type="client">
                    客户端
                    <NodeLabel>192.168.1.10</NodeLabel>
                </NodeBox>
                <NodeType>Client</NodeType>
            </NodeContainer>

            <NodeContainer $position="right">
                <NodeBox $active={serverActive} $type="server">
                    服务器
                    <NodeLabel>192.168.1.20</NodeLabel>
                </NodeBox>
                <NodeType>Server</NodeType>
            </NodeContainer>

            {children}
        </CanvasContainer>
    );
};

export default NetworkCanvas;