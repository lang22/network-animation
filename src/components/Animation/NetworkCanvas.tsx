import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { DEFAULT_NETWORK_CONFIG, CANVAS_LAYOUT, calculateBoundaryLines } from '@/utils/constants';
import { TcpConnectionState, NetworkPacket, TcpConnection } from '@/types/networkTypes';

const pulseGlow = keyframes`
    0%, 100% {
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }
    50% {
        box-shadow: 0 0 40px rgba(0, 212, 255, 0.6), 0 0 60px rgba(0, 212, 255, 0.3);
    }
`;

const burstRing = keyframes`
    0%   { inset: -2px; opacity: 0.9; border-width: 3px; }
    100% { inset: -14px; opacity: 0; border-width: 1px; }
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

// 端点盒子的脉冲波纹 - 收发数据包时触发
const BurstRing = styled.div<{ $type: 'client' | 'server' }>`
    position: absolute;
    border-radius: 14px;
    border: 2px solid ${({ $type }) =>
        $type === 'client'
            ? darkTheme.nodeColors.client.glow
            : darkTheme.nodeColors.server.glow};
    animation: ${burstRing} 0.6s ease-out forwards;
    pointer-events: none;
    z-index: 0;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    flex-shrink: 0;
`;

const StateLabel = styled.div`
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255,255,255,0.4);
    text-align: center;
    width: 100%;
`;

// 状态徽章 - 根据状态类型着色
const getStateColor = (state: string | null): { bg: string; text: string; glow: string } => {
    if (!state || state === 'CLOSED' || state === '-') {
        return { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)', glow: 'none' };
    }
    if (state === 'LISTEN') {
        return { bg: 'rgba(96, 165, 250, 0.2)', text: '#93c5fd', glow: '0 0 8px rgba(96, 165, 250, 0.3)' };
    }
    if (state === 'SYN_SENT' || state === 'SYN_RCVD') {
        return { bg: 'rgba(251, 191, 36, 0.2)', text: '#fcd34d', glow: '0 0 8px rgba(251, 191, 36, 0.3)' };
    }
    if (state === 'ESTABLISHED') {
        return { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', glow: '0 0 12px rgba(34, 197, 94, 0.4)' };
    }
    if (state === 'FIN_WAIT_1' || state === 'FIN_WAIT_2' || state === 'CLOSE_WAIT' || state === 'LAST_ACK' || state === 'CLOSING') {
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', glow: '0 0 8px rgba(239, 68, 68, 0.3)' };
    }
    if (state === 'TIME_WAIT') {
        return { bg: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa', glow: '0 0 8px rgba(139, 92, 246, 0.3)' };
    }
    return { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', glow: 'none' };
};

const StateBadge = styled.div<{ $state: string | null }>`
    font-size: 12px;
    font-weight: 700;
    padding: 6px 10px;
    border-radius: 6px;
    background: ${({ $state }) => getStateColor($state).bg};
    color: ${({ $state }) => getStateColor($state).text};
    box-shadow: ${({ $state }) => getStateColor($state).glow};
    text-align: center;
    width: 100%;
    transition: all 0.3s ease;
    letter-spacing: 0.5px;
`;

// 子状态信息（如"可以传输数据"）
const StateHint = styled.div`
    font-size: 9px;
    color: rgba(255,255,255,0.4);
    text-align: center;
`;

// 根据payload获取颜色
const getPacketColor = (payload: string): string => {
    if (payload === 'SYN') return '#fb923c';
    if (payload === 'SYN-ACK') return '#a78bfa';
    if (payload === 'ACK') return '#fbbf24';
    if (payload === 'FIN') return '#f87171';
    return '#38bdf8'; // DATA 青色
};

const getPacketLabel = (payload: string): string => {
    // 协议控制包：直接返回类型名
    if (payload === 'SYN') return 'SYN';
    if (payload === 'SYN-ACK') return 'SYN-ACK';
    if (payload === 'ACK') return 'ACK';
    if (payload === 'FIN') return 'FIN';
    // 其余都是数据包
    return 'DATA';
};

// 接收列表容器 - 填充剩余空间，可滚动
const ReceivedList = styled.div`
    flex: 1;
    width: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);

    /* 隐藏滚动条但可滚动 */
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
    &::-webkit-scrollbar {
        width: 3px;
    }
    &::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.15);
        border-radius: 3px;
    }
`;

// 单条接收记录 - 水平排列的彩色行，可点击查看详情
const ReceivedRow = styled.div<{ $color: string; $selected?: boolean }>`
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    color: ${({ $selected }) => $selected ? '#fff' : 'rgba(255,255,255,0.85)'};
    background: ${({ $selected, $color }) =>
        $selected ? `${$color}22` : 'rgba(255,255,255,0.04)'};
    cursor: pointer;
    transition: all 0.2s;
    outline: ${({ $selected, $color }) =>
        $selected ? `1px solid ${$color}66` : 'none'};
    outline-offset: 0;

    &:hover {
        background: ${({ $selected, $color }) =>
            $selected ? `${$color}33` : 'rgba(255,255,255,0.1)'};
    }

    &:active {
        background: rgba(255,255,255,0.14);
    }
`;

const ReceivedDot = styled.span<{ $color: string }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    box-shadow: 0 0 6px ${({ $color }) => $color};
    flex-shrink: 0;
`;

const ReceivedLabel = styled.span`
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

// SEQ/ACK 数值展示
const SeqAckBox = styled.div`
    width: 100%;
    margin-top: 4px;
    padding: 6px 8px;
    background: rgba(0,0,0,0.2);
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex-shrink: 0;
`;

const SeqAckRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
`;

const SeqAckLabel = styled.span`
    color: rgba(255,255,255,0.35);
`;

const SeqAckValue = styled.span`
    color: rgba(255,255,255,0.7);
    font-weight: 500;
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
// 数据包覆盖层 - 覆盖整个画布，数据包在此层飞行
const PacketsOverlay = styled.div`
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
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

// 轨道标签
const TrackLabel = styled.span<{ $y: number }>`
    position: absolute;
    left: 6px;
    top: ${({ $y }) => $y}%;
    transform: translateY(-50%);
    font-size: 7px;
    color: ${darkTheme.colors.textMuted};
    letter-spacing: 0.5px;
    white-space: nowrap;
    text-transform: uppercase;
    opacity: 0.4;
`;

// 连接光缆 - ESTABLISHED 时亮起
const ConnectionCable = styled.div<{ $active?: boolean }>`
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    transform: translateY(-50%);
    background: ${({ $active }) => $active
        ? `linear-gradient(90deg,
            ${darkTheme.nodeColors.client.glow},
            ${darkTheme.colors.primary},
            ${darkTheme.nodeColors.server.glow})`
        : darkTheme.colors.border};
    opacity: ${({ $active }) => $active ? 0.6 : 0.15};
    transition: opacity 0.4s, background 0.4s;
    box-shadow: ${({ $active }) => $active
        ? `0 0 10px ${darkTheme.colors.glow}, 0 0 20px ${darkTheme.colors.glow}`
        : 'none'};
`;

// ==================== 状态流转条 (通道底部) ====================
const StateBar = styled.div`
    position: absolute;
    bottom: 50px;
    left: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    pointer-events: none;
`;

const StateChip = styled.div<{ $active: boolean; $side: 'client' | 'server' }>`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 5px;
    font-size: 10px;
    font-weight: ${({ $active }) => $active ? 700 : 400};
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    background: ${({ $active, $side }) =>
        $active
            ? $side === 'client'
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(59, 130, 246, 0.15)'
            : 'rgba(255,255,255,0.03)'};
    color: ${({ $active }) => $active ? darkTheme.colors.text : darkTheme.colors.textMuted};
    border: 1px solid ${({ $active, $side }) =>
        $active
            ? $side === 'client'
                ? 'rgba(34, 197, 94, 0.4)'
                : 'rgba(59, 130, 246, 0.4)'
            : 'transparent'};
    transition: all 0.3s ease;
    white-space: nowrap;

    &::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${({ $active, $side }) =>
            $active
                ? $side === 'client' ? '#4ade80' : '#60a5fa'
                : darkTheme.colors.border};
        box-shadow: ${({ $active, $side }) =>
            $active
                ? $side === 'client'
                    ? '0 0 8px rgba(34, 197, 94, 0.6)'
                    : '0 0 8px rgba(59, 130, 246, 0.6)'
                : 'none'};
        flex-shrink: 0;
    }
`;

const StateArrow = styled.div<{ $active: boolean }>`
    width: 48px;
    height: 1px;
    background: ${({ $active }) =>
        $active ? darkTheme.colors.primary : darkTheme.colors.border};
    margin: 0 6px;
    opacity: ${({ $active }) => $active ? 0.7 : 0.2};
    position: relative;

    &::before {
        content: '';
        position: absolute;
        right: -3px;
        top: -3px;
        width: 0;
        height: 0;
        border-left: 6px solid ${({ $active }) =>
            $active ? darkTheme.colors.primary : darkTheme.colors.border};
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        opacity: ${({ $active }) => $active ? 0.7 : 0.2};
    }
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
    /** 客户端接收到的数据包（方向为 response 的包） */
    clientReceivedPackets?: NetworkPacket[];
    /** 服务端接收到的数据包（方向为 request 的包） */
    serverReceivedPackets?: NetworkPacket[];
    /** 点击接收包时的回调 */
    onPacketClick?: (packet: NetworkPacket) => void;
    /** 当前选中的数据包ID，用于高亮 */
    selectedPacketId?: string;
    /** TCP 连接信息，用于显示 SEQ/ACK */
    connection?: TcpConnection | null;
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
    serverIp = DEFAULT_NETWORK_CONFIG.SERVER_IP,
    clientReceivedPackets = [],
    serverReceivedPackets = [],
    onPacketClick,
    selectedPacketId,
    connection,
}) => {
    const isEstablished = clientState === TcpConnectionState.ESTABLISHED;
    const prevClientActive = useRef(clientActive);
    const prevServerActive = useRef(serverActive);
    const [clientBursts, setClientBursts] = useState<number[]>([]);
    const [serverBursts, setServerBursts] = useState<number[]>([]);

    // 客户端激活时触发脉冲
    useEffect(() => {
        if (clientActive && !prevClientActive.current) {
            const id = Date.now();
            setClientBursts(prev => [...prev, id]);
            setTimeout(() => setClientBursts(prev => prev.filter(x => x !== id)), 700);
        }
        prevClientActive.current = clientActive;
    }, [clientActive]);

    // 服务端激活时触发脉冲
    useEffect(() => {
        if (serverActive && !prevServerActive.current) {
            const id = Date.now();
            setServerBursts(prev => [...prev, id]);
            setTimeout(() => setServerBursts(prev => prev.filter(x => x !== id)), 700);
        }
        prevServerActive.current = serverActive;
    }, [serverActive]);

    // 轨道位置和标签
    const trackDefs = [
        { y: 14, label: '握手' },
        { y: 28, label: '握手' },
        { y: 42, label: '握手' },
        { y: 50, label: '挥手' },
        { y: 56, label: '传输' },
        { y: 60, label: '挥手' },
        { y: 70, label: '传输/挥手' },
        { y: 80, label: '挥手' },
    ];

    return (
        <CanvasContainer>
            {/* 客户端 */}
            <EndpointBox $active={clientActive} $type="client">
                {clientBursts.map(id => <BurstRing key={id} $type="client" />)}
                <EndpointTitle>客户端</EndpointTitle>
                <EndpointIP>{clientIp}</EndpointIP>
                <StateContainer>
                    <StateLabel>状态</StateLabel>
                    <StateBadge $state={getStateDisplayName(clientState)}>
                        {getStateDisplayName(clientState)}
                    </StateBadge>
                    {isEstablished && (
                        <StateHint>可以传输数据</StateHint>
                    )}
                </StateContainer>
                {clientReceivedPackets.length > 0 && (
                    <ReceivedList>
                        {clientReceivedPackets.map((p, i) => {
                            const color = getPacketColor(String(p.payload));
                            const isSelected = p.id === selectedPacketId;
                            return (
                                <ReceivedRow
                                    key={`cr_${i}`}
                                    $color={color}
                                    $selected={isSelected}
                                    onClick={() => onPacketClick?.(p)}
                                >
                                    <ReceivedDot $color={color} />
                                    <ReceivedLabel>{getPacketLabel(String(p.payload))}</ReceivedLabel>
                                </ReceivedRow>
                            );
                        })}
                    </ReceivedList>
                )}
                {connection && (
                    <SeqAckBox>
                        <SeqAckRow>
                            <SeqAckLabel>SEQ</SeqAckLabel>
                            <SeqAckValue>{connection.localSeqNum}</SeqAckValue>
                        </SeqAckRow>
                        <SeqAckRow>
                            <SeqAckLabel>ACK</SeqAckLabel>
                            <SeqAckValue>{connection.localAckNum}</SeqAckValue>
                        </SeqAckRow>
                    </SeqAckBox>
                )}
            </EndpointBox>

            {/* 中间通道区域 */}
            <ChannelArea>
                {/* 基准线 */}
                <ClientBoundaryLine />
                <ServerBoundaryLine />

                {/* 连接光缆 - 已连接时常亮，传输中时更亮 */}
                <ConnectionCable $active={isEstablished || connectionActive} />

                {/* 轨道线 + 标签 */}
                {trackDefs.map((t, i) => (
                    <React.Fragment key={i}>
                        <TrackLine $y={t.y} />
                        <TrackLabel $y={t.y}>{t.label}</TrackLabel>
                    </React.Fragment>
                ))}

                {/* 双方状态展示条 */}
                <StateBar>
                    <StateChip $active={!!clientState} $side="client">
                        {getStateDisplayName(clientState)}
                    </StateChip>
                    <StateArrow $active={!!clientState && !!serverState} />
                    <StateChip $active={!!serverState} $side="server">
                        {getStateDisplayName(serverState)}
                    </StateChip>
                </StateBar>

                {/* 连接状态 */}
                <ConnectionLabel $active={connectionActive}>
                    {connectionActive ? 'TCP Active' : 'TCP Channel'}
                </ConnectionLabel>
            </ChannelArea>

            {/* 服务端 */}
            <EndpointBox $active={serverActive} $type="server">
                {serverBursts.map(id => <BurstRing key={id} $type="server" />)}
                <EndpointTitle>服务端</EndpointTitle>
                <EndpointIP>{serverIp}</EndpointIP>
                <StateContainer>
                    <StateLabel>状态</StateLabel>
                    <StateBadge $state={getStateDisplayName(serverState)}>
                        {getStateDisplayName(serverState)}
                    </StateBadge>
                    {isEstablished && (
                        <StateHint>等待数据</StateHint>
                    )}
                </StateContainer>
                {serverReceivedPackets.length > 0 && (
                    <ReceivedList>
                        {serverReceivedPackets.map((p, i) => {
                            const color = getPacketColor(String(p.payload));
                            const isSelected = p.id === selectedPacketId;
                            return (
                                <ReceivedRow
                                    key={`sr_${i}`}
                                    $color={color}
                                    $selected={isSelected}
                                    onClick={() => onPacketClick?.(p)}
                                >
                                    <ReceivedDot $color={color} />
                                    <ReceivedLabel>{getPacketLabel(String(p.payload))}</ReceivedLabel>
                                </ReceivedRow>
                            );
                        })}
                    </ReceivedList>
                )}
                {connection && (
                    <SeqAckBox>
                        <SeqAckRow>
                            <SeqAckLabel>SEQ</SeqAckLabel>
                            <SeqAckValue>{connection.remoteSeqNum}</SeqAckValue>
                        </SeqAckRow>
                        <SeqAckRow>
                            <SeqAckLabel>ACK</SeqAckLabel>
                            <SeqAckValue>{connection.remoteAckNum}</SeqAckValue>
                        </SeqAckRow>
                    </SeqAckBox>
                )}
            </EndpointBox>

            {/* 数据包覆盖层 - 画布层级，坐标基于整个画布 */}
            <PacketsOverlay>
                {children}
            </PacketsOverlay>
        </CanvasContainer>
    );
};

export default NetworkCanvas;