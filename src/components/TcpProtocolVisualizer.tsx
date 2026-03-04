import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useTcpAnimation } from '@/hooks/useTcpAnimation';
import { TcpConnectionState } from '@/types/networkTypes';
import { darkTheme } from '@/styles/theme';
import Header from '@/components/Layout/Header';
import NetworkCanvas from '@/components/Animation/NetworkCanvas';
import Packet from '@/components/Animation/Packet';
import ProtocolStackPanel from '@/components/Panels/ProtocolStackPanel';
import PacketDetailPanel from '@/components/Panels/PacketDetailPanel';
import TimelinePanel from '@/components/Panels/TimelinePanel';

const Container = styled.div`
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: ${darkTheme.colors.background};
`;

const MainContent = styled.div`
    flex: 1;
    display: flex;
    justify-content: space-between;
    padding: 12px;
    gap: 12px;
    min-height: 0;
    width: 100%;
`;

// 左侧操作面板
const LeftPanel = styled.div`
    width: 140px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
`;

const ControlsCard = styled.div`
    background: ${darkTheme.colors.surface};
    border-radius: 10px;
    border: 1px solid ${darkTheme.colors.border};
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const PanelTitle = styled.div`
    font-size: 11px;
    font-weight: 600;
    color: ${darkTheme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger'; $animating?: boolean }>`
    width: 100%;
    padding: 10px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: ${({ $animating }) => ($animating ? 'wait' : 'pointer')};
    transition: all 0.2s ease;

    ${({ $variant }) => {
        switch ($variant) {
            case 'primary':
                return `
                    background: linear-gradient(135deg, ${darkTheme.colors.primary} 0%, ${darkTheme.colors.primaryDark} 100%);
                    color: white;
                    border: none;
                    &:hover:not(:disabled) { transform: translateY(-1px); }
                `;
            case 'danger':
                return `
                    background: linear-gradient(135deg, ${darkTheme.colors.error} 0%, #dc2626 100%);
                    color: white;
                    border: none;
                `;
            default:
                return `
                    background: ${darkTheme.colors.surfaceLight};
                    color: ${darkTheme.colors.text};
                    border: 1px solid ${darkTheme.colors.border};
                    &:hover:not(:disabled) { border-color: ${darkTheme.colors.primary}; }
                `;
        }
    }}

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const SpeedControl = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const SpeedLabel = styled.div`
    font-size: 11px;
    color: ${darkTheme.colors.textMuted};
`;

const SpeedButtons = styled.div`
    display: flex;
    gap: 4px;
`;

const SpeedButton = styled.button<{ $active?: boolean }>`
    flex: 1;
    padding: 6px 4px;
    background: ${({ $active }) => $active ? 'rgba(0, 212, 255, 0.15)' : 'transparent'};
    border: 1px solid ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.border};
    border-radius: 4px;
    color: ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.textMuted};
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        border-color: ${darkTheme.colors.primary};
        color: ${darkTheme.colors.primary};
    }
`;

const StatusBadge = styled.div<{ $status: 'idle' | 'connected' | 'closed' }>`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    background: ${darkTheme.colors.surfaceLight};
    border-radius: 6px;
    border: 1px solid ${darkTheme.colors.border};
`;

const StatusDot = styled.div<{ $status: 'idle' | 'connected' | 'closed' }>`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ $status }) =>
        $status === 'connected' ? darkTheme.colors.success :
            $status === 'closed' ? darkTheme.colors.error : darkTheme.colors.textMuted};
    box-shadow: ${({ $status }) =>
        $status === 'connected' ? `0 0 8px ${darkTheme.colors.success}` : 'none'};
`;

const StatusText = styled.span`
    font-size: 10px;
    color: ${darkTheme.colors.text};
    font-weight: 500;
`;

const AnimationStatus = styled.div`
    padding: 8px 10px;
    background: linear-gradient(90deg, rgba(0, 212, 255, 0.1), transparent);
    border-left: 3px solid ${darkTheme.colors.primary};
    border-radius: 0 6px 6px 0;
    font-size: 10px;
    color: ${darkTheme.colors.text};
    line-height: 1.4;
`;

const ConnectionInfo = styled.div`
    padding: 8px;
    background: ${darkTheme.colors.surfaceLight};
    border-radius: 6px;
    font-size: 9px;
    color: ${darkTheme.colors.textMuted};
    display: flex;
    flex-direction: column;
    gap: 3px;

    div {
        display: flex;
        justify-content: space-between;
    }

    strong {
        color: ${darkTheme.colors.text};
        font-weight: 500;
    }
`;

// 中间动画区域 - 弹性扩展
const CenterPanel = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    height: 100%;
`;

const AnimationContainer = styled.div`
    flex: 1;
    min-height: 300px;
    background: ${darkTheme.colors.surface};
    border-radius: 10px;
    border: 1px solid ${darkTheme.colors.border};
    position: relative;
    overflow: hidden;
`;

const AnimationWrapper = styled.div`
    position: absolute;
    inset: 0;
`;

// 右侧详情面板
const RightPanel = styled.div`
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
`;

const TcpProtocolVisualizer: React.FC = () => {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [speed, setSpeed] = useState(1);

    const {
        connection,
        isPlaying,
        animationStatus,
        animationUI,
        packetHistory,
        selectedPacket,
        currentPhase,
        timelineSteps,
        performHandshake,
        performDataTransfer,
        performClose,
        resetConnection,
        updateContainerSize,
        selectPacket,
    } = useTcpAnimation();

    // 使用 ResizeObserver 监听容器尺寸变化
    useEffect(() => {
        const diagram = diagramRef.current;
        if (!diagram) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                updateContainerSize(width, height);
            }
        });

        resizeObserver.observe(diagram);

        const { clientWidth, clientHeight } = diagram;
        if (clientWidth > 0 && clientHeight > 0) {
            updateContainerSize(clientWidth, clientHeight);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [updateContainerSize]);

    // 事件处理
    const handleHandshake = useCallback(() => performHandshake(), [performHandshake]);
    const handleDataTransfer = useCallback(() => performDataTransfer(), [performDataTransfer]);
    const handleClose = useCallback(() => performClose(), [performClose]);
    const handleReset = useCallback(() => resetConnection(), [resetConnection]);

    // 连接状态
    const getConnectionStatus = (): 'idle' | 'connected' | 'closed' => {
        if (!connection) return 'idle';
        if (connection.state === TcpConnectionState.CLOSED) return 'closed';
        if (connection.state === TcpConnectionState.ESTABLISHED) return 'connected';
        return 'idle';
    };

    // 获取时间线标题
    const getTimelineTitle = () => {
        switch (currentPhase) {
            case 'handshake': return '三次握手';
            case 'data': return '数据传输';
            case 'close': return '四次挥手';
            default: return '协议流程';
        }
    };

    const connectionStatus = getConnectionStatus();

    return (
        <Container>
            <Header />

            <MainContent>
                {/* 左侧操作面板 */}
                <LeftPanel>
                    <ControlsCard>
                        <PanelTitle>操作控制</PanelTitle>
                        <Button
                            onClick={handleHandshake}
                            disabled={isPlaying || !!connection}
                            $variant="primary"
                            $animating={isPlaying}
                        >
                            {connection ? '已连接' : '三次握手'}
                        </Button>
                        <Button
                            onClick={handleDataTransfer}
                            disabled={isPlaying || !connection || connection.state !== TcpConnectionState.ESTABLISHED}
                            $variant="secondary"
                        >
                            发送数据
                        </Button>
                        <Button
                            onClick={handleClose}
                            disabled={isPlaying || !connection || connection.state !== TcpConnectionState.ESTABLISHED}
                            $variant="danger"
                        >
                            四次挥手
                        </Button>
                        <Button onClick={handleReset} disabled={isPlaying}>
                            重置
                        </Button>
                    </ControlsCard>

                    <ControlsCard>
                        <SpeedControl>
                            <SpeedLabel>动画速度</SpeedLabel>
                            <SpeedButtons>
                                <SpeedButton $active={speed === 0.5} onClick={() => setSpeed(0.5)}>0.5x</SpeedButton>
                                <SpeedButton $active={speed === 1} onClick={() => setSpeed(1)}>1x</SpeedButton>
                                <SpeedButton $active={speed === 2} onClick={() => setSpeed(2)}>2x</SpeedButton>
                            </SpeedButtons>
                        </SpeedControl>
                    </ControlsCard>

                    <StatusBadge $status={connectionStatus}>
                        <StatusDot $status={connectionStatus} />
                        <StatusText>
                            {connectionStatus === 'connected' ? '已连接' :
                                connectionStatus === 'closed' ? '已关闭' : '未连接'}
                        </StatusText>
                    </StatusBadge>

                    {animationStatus && <AnimationStatus>{animationStatus}</AnimationStatus>}

                    {connection && (
                        <ConnectionInfo>
                            <div>本地端口: <strong>{connection.sourcePort}</strong></div>
                            <div>远程端口: <strong>{connection.destinationPort}</strong></div>
                            <div>序列号: <strong>{connection.localSeqNum}</strong></div>
                            <div>窗口: <strong>{connection.windowSize}</strong></div>
                        </ConnectionInfo>
                    )}
                </LeftPanel>

                {/* 中间动画区域 */}
                <CenterPanel>
                    <AnimationContainer>
                        <AnimationWrapper ref={diagramRef}>
                            <NetworkCanvas
                                clientActive={animationUI.clientActive}
                                serverActive={animationUI.serverActive}
                                connectionActive={animationUI.connectionLineActive}
                            >
                                <Packet
                                    x={animationUI.packetPosition.x}
                                    y={animationUI.packetPosition.y}
                                    type={animationUI.currentPacketType}
                                    moving={isPlaying}
                                    onClick={() => {
                                        if (packetHistory.length > 0) {
                                            const lastPacket = packetHistory[packetHistory.length - 1];
                                            selectPacket(lastPacket.packet);
                                        }
                                    }}
                                />
                            </NetworkCanvas>
                        </AnimationWrapper>
                    </AnimationContainer>

                    {timelineSteps.length > 0 && (
                        <TimelinePanel title={getTimelineTitle()} steps={timelineSteps} />
                    )}
                </CenterPanel>

                {/* 右侧详情面板 */}
                <RightPanel>
                    <ProtocolStackPanel activeLayers={animationUI.activeLayers} />
                    <PacketDetailPanel packet={selectedPacket} />
                </RightPanel>
            </MainContent>
        </Container>
    );
};

export default TcpProtocolVisualizer;