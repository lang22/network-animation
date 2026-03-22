import React from 'react';
import styled, { keyframes, css } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { DEFAULT_NETWORK_CONFIG, CANVAS_LAYOUT, calculateBoundaryLines } from '@/utils/constants';
import { TcpConnectionState } from '@/types/networkTypes';

const pulseGlow = keyframes`
    0%, 100% {
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }
    50% {
        box-shadow: 0 0 40px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3);
    }
`;

// 主容器 - 三列布局
const CanvasContainer = styled.div`
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, ${darkTheme.colors.background} 0%, ${darkTheme.colors.surface} 100%);
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: ${CANVAS_LAYOUT.ENDPOINT_WIDTH}px 1fr ${CANVAS_LAYOUT.ENDPOINT_WIDTH}px;
    padding: ${CANVAS_LAYOUT.OUTER_PADDING}px;
    gap: ${CANVAS_LAYOUT.GAP}px;
`;

// 端点盒子
const EndpointBox = styled.div<{ $active?: boolean; $type: 'client' | 'server' }>`
    width: 100%;
    height: 100%;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    color: white;
    position: relative;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(
        180deg,
        ${({ $type }) => darkTheme.nodeColors[$type].from} 0%,
        ${({ $type }) => darkTheme.nodeColors[$type].to} 100%
    );
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.1);

    ${({ $active }) =>
        $active &&
        css`
            animation: ${pulseGlow} 1.5s ease-in-out infinite;
        `}
`;

const EndpointTitle = styled.div`
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 6px;
    text-align: center;
`;

const EndpointIP = styled.div`
    font-size: 10px;
    opacity: 0.7;
    margin-bottom: 12px;
    text-align: center;
`;

const StateContainer = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    width: 100%;
`;

const StateLabel = styled.div<{ $highlight?: boolean }>`
    font-size: 10px;
    padding: 4px 6px;
    border-radius: 4px;
    background: ${({ $highlight }) => $highlight ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255,255,255,0.1)'};
    color: ${({ $highlight }) => $highlight ? darkTheme.colors.primary : 'rgba(255,255,255,0.7)'};
    text-align: center;
    width: 100%;
    transition: all 0.3s ease;
`;

const StateValue = styled.div`
    font-size: 9px;
    color: rgba(255,255,255,0.5);
`;

// 中间通道区域 - 数据包在这里移动
const ChannelArea = styled.div`
    position: relative;
    height: 100%;
    background: rgba(20, 27, 45, 0.5);
    border-radius: 8px;
    border: 1px solid ${darkTheme.colors.border};
    overflow: hidden;
`;

// 基准线 - 客户端边界
const ClientBoundaryLine = styled.div`
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
        180deg,
        transparent 0%,
        ${darkTheme.nodeColors.client.from} 20%,
        ${darkTheme.nodeColors.client.from} 80%,
        transparent 100%
    );
    z-index: 5;
`;

// 基准线 - 服务端边界
const ServerBoundaryLine = styled.div`
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
        180deg,
        transparent 0%,
        ${darkTheme.nodeColors.server.from} 20%,
        ${darkTheme.nodeColors.server.from} 80%,
        transparent 100%
    );
    z-index: 5;
`;

// 轨道线 - 显示数据包移动路径
const TrackLine = styled.div<{ $y: number }>`
    position: absolute;
    left: 0;
    right: 0;
    top: ${({ $y }) => $y}%;
    height: 1px;
    background: ${darkTheme.colors.border};
    opacity: 0.2;
`;

// 数据包容器 - 在通道区域内
const PacketsContainer = styled.div`
    position: absolute;
    inset: 0;
    z-index: 10;
`;

// 连接状态标签
const ConnectionLabel = styled.div<{ $active?: boolean }>`
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: ${({ $active }) => $active ? darkTheme.colors.success : darkTheme.colors.textMuted};
    padding: 4px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
`;

interface NetworkCanvasProps {
    clientActive: boolean;
    serverActive: boolean;
    connectionActive: boolean;
    clientState: TcpConnectionState | null;
    serverState: TcpConnectionState | null;
    children?: React.ReactNode;
    clientIp?: string;
    serverIp?: string;
}

const getStateDisplayName = (state?: TcpConnectionState | null): string => {
    if (!state) return '-';
    const stateNames: Record<TcpConnectionState, string> = {
        [TcpConnectionState.CLOSED]: 'CLOSED',
        [TcpConnectionState.LISTEN]: 'LISTEN',
        [TcpConnectionState.SYN_SENT]: 'SYN_SENT',
        [TcpConnectionState.SYN_RECEIVED]: 'SYN_RCVD',
        [TcpConnectionState.ESTABLISHED]: 'ESTABLISHED',
        [TcpConnectionState.FIN_WAIT_1]: 'FIN_WAIT_1',
        [TcpConnectionState.FIN_WAIT_2]: 'FIN_WAIT_2',
        [TcpConnectionState.CLOSE_WAIT]: 'CLOSE_WAIT',
        [TcpConnectionState.CLOSING]: 'CLOSING',
        [TcpConnectionState.LAST_ACK]: 'LAST_ACK',
        [TcpConnectionState.TIME_WAIT]: 'TIME_WAIT',
    };
    return stateNames[state] || state;
};

const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
    clientActive,
    serverActive,
    connectionActive,
    clientState,
    serverState,
    children,
    clientIp = DEFAULT_NETWORK_CONFIG.CLIENT_IP,
    serverIp = DEFAULT_NETWORK_CONFIG.SERVER_IP
}) => {
    const isEstablished = clientState === TcpConnectionState.ESTABLISHED;

    // 轨道位置 - 数据包在不同轨道上移动
    const tracks = [15, 30, 45, 60, 75, 90];

    return (
        <CanvasContainer>
            {/* 客户端 */}
            <EndpointBox $active={clientActive} $type="client">
                <EndpointTitle>客户端</EndpointTitle>
                <EndpointIP>{clientIp}</EndpointIP>
                <StateContainer>
                    <StateLabel $highlight={!!clientState}>
                        状态
                    </StateLabel>
                    <StateValue>{getStateDisplayName(clientState)}</StateValue>
                    {isEstablished && (
                        <>
                            <StateLabel>连接已建立</StateLabel>
                            <StateValue>可以传输数据</StateValue>
                        </>
                    )}
                </StateContainer>
            </EndpointBox>

            {/* 中间通道区域 */}
            <ChannelArea>
                {/* 基准线 */}
                <ClientBoundaryLine />
                <ServerBoundaryLine />

                {/* 轨道线 */}
                {tracks.map((y, index) => (
                    <TrackLine key={index} $y={y} />
                ))}

                {/* 数据包容器 */}
                <PacketsContainer>
                    {children}
                </PacketsContainer>

                {/* 连接状态 */}
                <ConnectionLabel $active={connectionActive}>
                    {connectionActive ? 'TCP Active' : 'TCP Channel'}
                </ConnectionLabel>
            </ChannelArea>

            {/* 服务端 */}
            <EndpointBox $active={serverActive} $type="server">
                <EndpointTitle>服务端</EndpointTitle>
                <EndpointIP>{serverIp}</EndpointIP>
                <StateContainer>
                    <StateLabel $highlight={!!serverState}>
                        状态
                    </StateLabel>
                    <StateValue>{getStateDisplayName(serverState)}</StateValue>
                    {isEstablished && (
                        <>
                            <StateLabel>连接已建立</StateLabel>
                            <StateValue>等待数据</StateValue>
                        </>
                    )}
                </StateContainer>
            </EndpointBox>
        </CanvasContainer>
    );
};

export default NetworkCanvas;