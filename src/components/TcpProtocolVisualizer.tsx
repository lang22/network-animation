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

// ==================== 页面容器 ====================
const PageContainer = styled.div`
    width: 100vw;
    height: 100vh;
    display: grid;
    grid-template-rows: 48px 1fr;
    background: ${darkTheme.colors.background};
    overflow: hidden;
`;

// ==================== 主内容区域 ====================
const MainLayout = styled.div`
    display: grid;
    grid-template-columns: 220px 1fr 300px;
    gap: 16px;
    padding: 16px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow: hidden;
`;

// ==================== 通用面板样式 ====================
const Panel = styled.div`
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const PanelHeader = styled.div`
    padding: 14px 16px;
    border-bottom: 1px solid ${darkTheme.colors.border};
    font-size: 13px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
`;

const PanelContent = styled.div`
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    flex: 1;
`;

// ==================== 按钮样式 ====================
const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
    width: 100%;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    ${({ $variant }) => {
        switch ($variant) {
            case 'primary':
                return `
                    background: ${darkTheme.colors.primary};
                    color: #000;
                    border: none;
                    &:hover:not(:disabled) { opacity: 0.9; }
                `;
            case 'danger':
                return `
                    background: ${darkTheme.colors.error};
                    color: white;
                    border: none;
                    &:hover:not(:disabled) { opacity: 0.9; }
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
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const ButtonGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

// ==================== 速度控制 ====================
const SpeedControl = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const SpeedLabel = styled.div`
    font-size: 12px;
    color: ${darkTheme.colors.textMuted};
`;

const SpeedButtons = styled.div`
    display: flex;
    gap: 6px;
`;

const SpeedBtn = styled.button<{ $active?: boolean }>`
    flex: 1;
    padding: 8px;
    background: ${({ $active }) => $active ? darkTheme.colors.primary : 'transparent'};
    border: 1px solid ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.border};
    border-radius: 6px;
    color: ${({ $active }) => $active ? '#000' : darkTheme.colors.textMuted};
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        border-color: ${darkTheme.colors.primary};
        color: ${({ $active }) => $active ? '#000' : darkTheme.colors.primary};
    }
`;

// ==================== 状态显示 ====================
const StatusRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: ${darkTheme.colors.surfaceLight};
    border-radius: 8px;
`;

const StatusIndicator = styled.div<{ $status: 'idle' | 'connected' | 'closed' }>`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ $status }) =>
        $status === 'connected' ? darkTheme.colors.success :
            $status === 'closed' ? darkTheme.colors.error : darkTheme.colors.textMuted};
    box-shadow: ${({ $status }) =>
        $status === 'connected' ? `0 0 10px ${darkTheme.colors.success}` : 'none'};
`;

const StatusLabel = styled.span`
    font-size: 13px;
    color: ${darkTheme.colors.text};
    font-weight: 500;
`;

// ==================== 动画状态 ====================
const AnimationMessage = styled.div`
    padding: 12px;
    background: linear-gradient(90deg, rgba(0, 212, 255, 0.1), transparent);
    border-left: 3px solid ${darkTheme.colors.primary};
    border-radius: 0 8px 8px 0;
    font-size: 12px;
    color: ${darkTheme.colors.text};
`;

// ==================== 错误卡片 ====================
const ErrorBox = styled.div`
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid ${darkTheme.colors.error};
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ErrorText = styled.div`
    font-size: 12px;
    color: ${darkTheme.colors.error};
    font-weight: 500;
`;

const ErrorDetail = styled.div`
    font-size: 11px;
    color: ${darkTheme.colors.textMuted};
`;

const ErrorActions = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 4px;
`;

const ErrorBtn = styled.button<{ $primary?: boolean }>`
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;

    ${({ $primary }) => $primary ? `
        background: ${darkTheme.colors.error};
        color: white;
        border: none;
    ` : `
        background: transparent;
        color: ${darkTheme.colors.text};
        border: 1px solid ${darkTheme.colors.border};
    `}
`;

// ==================== 连接信息 ====================
const ConnectionGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
`;

const InfoItem = styled.div`
    padding: 10px;
    background: ${darkTheme.colors.surfaceLight};
    border-radius: 6px;
    text-align: center;
`;

const InfoLabel = styled.div`
    font-size: 10px;
    color: ${darkTheme.colors.textMuted};
    margin-bottom: 4px;
`;

const InfoValue = styled.div`
    font-size: 13px;
    color: ${darkTheme.colors.text};
    font-weight: 600;
`;

// ==================== 中间动画区域 ====================
const AnimationPanel = styled.div`
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    position: relative;
    overflow: hidden;
    height: 100%;
`;

const AnimationArea = styled.div`
    position: absolute;
    inset: 0;
`;

// ==================== 悬浮时间线 ====================
const TimelineBar = styled.div`
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: rgba(20, 27, 45, 0.95);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    border: 1px solid ${darkTheme.colors.border};
    padding: 14px 24px;
    min-width: 400px;
`;

const TimelineTitle = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
    margin-bottom: 12px;
    text-align: center;
`;

const TimelineProgress = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
`;

const ProgressStep = styled.div<{ $active?: boolean; $done?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;

    &:not(:last-child)::after {
        content: '';
        width: 60px;
        height: 2px;
        background: ${({ $done }) => $done ? darkTheme.colors.primary : darkTheme.colors.border};
    }
`;

const ProgressDot = styled.div<{ $active?: boolean; $done?: boolean }>`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${({ $active, $done }) =>
        $active ? darkTheme.colors.primary :
            $done ? darkTheme.colors.success : darkTheme.colors.surfaceLight};
    border: 2px solid ${({ $active, $done }) =>
        $active ? darkTheme.colors.primary :
            $done ? darkTheme.colors.success : darkTheme.colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 11px;
    color: white;
    box-shadow: ${({ $active }) => $active ? `0 0 12px ${darkTheme.colors.glow}` : 'none'};
`;

const ProgressLabel = styled.span<{ $active?: boolean; $done?: boolean }>`
    font-size: 12px;
    font-weight: 500;
    color: ${({ $active, $done }) =>
        $active ? darkTheme.colors.primary :
            $done ? darkTheme.colors.success : darkTheme.colors.textMuted};
    white-space: nowrap;
`;

// ==================== 主组件 ====================
const TcpProtocolVisualizer: React.FC = () => {
    const diagramRef = useRef<HTMLDivElement>(null);
    const [speed, setSpeed] = useState(1);  // 默认1x速度

    const {
        connection,
        isPlaying,
        animationStatus,
        animationUI,
        packetHistory,
        selectedPacket,
        currentPhase,
        timelineSteps,
        error,
        performHandshake,
        performDataTransfer,
        performClose,
        resetConnection,
        updateContainerSize,
        selectPacket,
        clearErrorState,
        retryFailedPhase,
    } = useTcpAnimation(speed);

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

        return () => resizeObserver.disconnect();
    }, [updateContainerSize]);

    const handleHandshake = useCallback(() => performHandshake(), [performHandshake]);
    const handleDataTransfer = useCallback(() => performDataTransfer(), [performDataTransfer]);
    const handleClose = useCallback(() => performClose(), [performClose]);
    const handleReset = useCallback(() => resetConnection(), [resetConnection]);

    const getConnectionStatus = (): 'idle' | 'connected' | 'closed' => {
        if (!connection) return 'idle';
        if (connection.state === TcpConnectionState.CLOSED) return 'closed';
        if (connection.state === TcpConnectionState.ESTABLISHED) return 'connected';
        return 'idle';
    };

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
        <PageContainer>
            <Header />
            <MainLayout>
                {/* 左侧控制面板 */}
                <Panel>
                    <PanelHeader>🎮 操作控制</PanelHeader>
                    <PanelContent>
                        <ButtonGroup>
                            <Button
                                $variant="primary"
                                onClick={handleHandshake}
                                disabled={isPlaying || !!connection}
                            >
                                {connection ? '已连接' : '开始握手'}
                            </Button>
                            <Button
                                $variant="secondary"
                                onClick={handleDataTransfer}
                                disabled={isPlaying || !connection || connection.state !== TcpConnectionState.ESTABLISHED}
                            >
                                发送数据
                            </Button>
                            <Button
                                $variant="danger"
                                onClick={handleClose}
                                disabled={isPlaying || !connection || connection.state !== TcpConnectionState.ESTABLISHED}
                            >
                                关闭连接
                            </Button>
                            <Button onClick={handleReset} disabled={isPlaying}>
                                重置
                            </Button>
                        </ButtonGroup>

                        <SpeedControl>
                            <SpeedLabel>动画速度</SpeedLabel>
                            <SpeedButtons>
                                <SpeedBtn $active={speed === 0.5} onClick={() => setSpeed(0.5)}>0.5x</SpeedBtn>
                                <SpeedBtn $active={speed === 1} onClick={() => setSpeed(1)}>1x</SpeedBtn>
                                <SpeedBtn $active={speed === 2} onClick={() => setSpeed(2)}>2x</SpeedBtn>
                            </SpeedButtons>
                        </SpeedControl>

                        <StatusRow>
                            <StatusIndicator $status={connectionStatus} />
                            <StatusLabel>
                                {connectionStatus === 'connected' ? '已连接' :
                                    connectionStatus === 'closed' ? '已关闭' : '未连接'}
                            </StatusLabel>
                        </StatusRow>

                        {animationStatus && <AnimationMessage>{animationStatus}</AnimationMessage>}

                        {error.hasError && (
                            <ErrorBox>
                                <ErrorText>⚠️ {error.message}</ErrorText>
                                {error.details && <ErrorDetail>{error.details}</ErrorDetail>}
                                <ErrorActions>
                                    <ErrorBtn $primary onClick={retryFailedPhase}>重试</ErrorBtn>
                                    <ErrorBtn onClick={clearErrorState}>关闭</ErrorBtn>
                                </ErrorActions>
                            </ErrorBox>
                        )}

                        {connection && (
                            <ConnectionGrid>
                                <InfoItem>
                                    <InfoLabel>本地端口</InfoLabel>
                                    <InfoValue>{connection.sourcePort}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>远程端口</InfoLabel>
                                    <InfoValue>{connection.destinationPort}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>序列号</InfoLabel>
                                    <InfoValue>{connection.localSeqNum}</InfoValue>
                                </InfoItem>
                                <InfoItem>
                                    <InfoLabel>窗口大小</InfoLabel>
                                    <InfoValue>{connection.windowSize}</InfoValue>
                                </InfoItem>
                            </ConnectionGrid>
                        )}
                    </PanelContent>
                </Panel>

                {/* 中间动画区域 */}
                <AnimationPanel>
                    {timelineSteps.length > 0 && (
                        <TimelineBar>
                            <TimelineTitle>⏱️ {getTimelineTitle()}</TimelineTitle>
                            <TimelineProgress>
                                {timelineSteps.map((step, index) => (
                                    <ProgressStep
                                        key={step.id}
                                        $active={step.active}
                                        $done={step.completed}
                                    >
                                        <ProgressDot $active={step.active} $done={step.completed}>
                                            {step.completed ? '✓' : step.active ? '●' : (index + 1)}
                                        </ProgressDot>
                                        <ProgressLabel $active={step.active} $done={step.completed}>
                                            {step.label}
                                        </ProgressLabel>
                                    </ProgressStep>
                                ))}
                            </TimelineProgress>
                        </TimelineBar>
                    )}
                    <AnimationArea ref={diagramRef}>
                        <NetworkCanvas
                            clientActive={animationUI.clientActive}
                            serverActive={animationUI.serverActive}
                            connectionActive={animationUI.connectionLineActive}
                            clientState={animationUI.clientState}
                            serverState={animationUI.serverState}
                        >
                            {animationUI.activePackets.map((packet) => (
                                    <Packet
                                        key={packet.id}
                                        x={packet.position.x}
                                        y={packet.position.y}
                                        type={packet.type}
                                        moving={!packet.completed}
                                        direction={packet.direction}
                                        seqNum={packet.seqNum}
                                        ackNum={packet.ackNum}
                                        onClick={() => {
                                            const historyPacket = packetHistory.find(
                                                p => p.packet.tcpHeader?.sequenceNumber === packet.seqNum
                                            );
                                            if (historyPacket) {
                                                selectPacket(historyPacket.packet);
                                            }
                                        }}
                                    />
                                ))}
                        </NetworkCanvas>
                    </AnimationArea>
                </AnimationPanel>

                {/* 右侧信息面板 */}
                <Panel>
                    <PanelHeader>📡 协议栈</PanelHeader>
                    <PanelContent style={{ flex: '0 0 auto' }}>
                        <ProtocolStackPanel activeLayers={animationUI.activeLayers} />
                    </PanelContent>
                    <PanelHeader>📦 数据包详情</PanelHeader>
                    <PanelContent style={{ flex: '1' }}>
                        <PacketDetailPanel packet={selectedPacket} />
                    </PanelContent>
                </Panel>
            </MainLayout>
        </PageContainer>
    );
};

export default TcpProtocolVisualizer;