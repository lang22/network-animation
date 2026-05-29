import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
    setConnection,
    setAnimationStatus,
    reset,
    play,
    pause,
    setAnimationUI,
    addActivePacket,
    updateActivePacket,
    completeActivePacket,
    removeActivePacket,
    clearActivePackets,
    setActiveLayers,
    setClientActive,
    setServerActive,
    setConnectionLineActive,
    setClientState,
    setServerState,
    setContainerSize,
    addPacketToHistory,
    setSelectedPacket,
    setCurrentPhase,
    updateTimelineStep,
    setError,
    clearError,
    setFullFlowActive,
    ActivePacket,
} from '@/store/slices/simulationSlice';
import { TcpService } from '@/services/protocols/tcpService';
import { TcpConnection, TcpConnectionState, NetworkPacket, TcpFlags } from '@/types/networkTypes';
import {
    NETWORK_POSITIONS,
    ANIMATION_DURATION,
    DEFAULT_NETWORK_CONFIG,
    PacketType,
    calculatePacketPosition,
    calculateBoundaryLines,
} from '@/utils/constants';

export const useTcpAnimation = (speed: number = 1) => {
    const dispatch = useAppDispatch();
    const {
        connection,
        isPlaying,
        fullFlowActive,
        animationStatus,
        animationUI,
        packetHistory,
        selectedPacket,
        currentPhase,
        timelineSteps,
        error
    } = useAppSelector((state) => state.simulation);

    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const speedRef = useRef<number>(speed);
    const connectionRef = useRef(connection);
    const fullFlowActiveRef = useRef(false);

    // 保持 refs 最新
    useEffect(() => {
        speedRef.current = speed;
    }, [speed]);
    useEffect(() => {
        connectionRef.current = connection;
    }, [connection]);

    const containerSize = animationUI.containerSize;

    // 根据速度计算实际动画持续时间
    const getAnimationDuration = useCallback((baseDuration: number) => {
        return baseDuration / speedRef.current;
    }, []);

    // 清理动画资源
    const cleanupAnimation = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    // 更新容器尺寸
    const updateContainerSize = useCallback(
        (width: number, height: number) => {
            dispatch(setContainerSize({ width, height }));
        },
        [dispatch]
    );

    // 选择数据包
    const selectPacket = useCallback(
        (packet: NetworkPacket | null) => {
            dispatch(setSelectedPacket(packet));
        },
        [dispatch]
    );

    // 动画数据包移动
    const animatePacketMove = useCallback(
        (
            fromClient: boolean,  // true: 从客户端发送，false: 从服务端发送
            trackY: number,       // 轨道Y位置百分比
            packetType: PacketType,
            packet: NetworkPacket,
            stepId: string,
            duration: number = ANIMATION_DURATION.PACKET_MOVE
        ): Promise<void> => {
            return new Promise((resolve) => {
                if (!isMountedRef.current) {
                    resolve();
                    return;
                }

                // 根据速度调整动画持续时间
                const adjustedDuration = getAnimationDuration(duration);

                // 计算起始位置（progress = 0）
                const startPos = calculatePacketPosition(
                    fromClient,
                    trackY,
                    0,
                    containerSize.width,
                    containerSize.height
                );

                // 创建唯一的数据包ID
                const packetId = `packet_${stepId}_${Date.now()}`;

                // 设置当前步骤为 active
                dispatch(updateTimelineStep({ id: stepId, active: true }));

                // 创建活动数据包
                const activePacket: ActivePacket = {
                    id: packetId,
                    type: packetType,
                    position: { ...startPos },
                    targetPosition: { x: 0, y: 0 }, // 将在动画过程中更新
                    startTime: performance.now(),
                    duration: adjustedDuration,
                    seqNum: packet.tcpHeader?.sequenceNumber,
                    ackNum: packet.tcpHeader?.acknowledgmentNumber,
                    completed: false,
                    direction: fromClient ? 'right' : 'left',
                    networkPacketId: packet.id,  // 精确关联 NetworkPacket，点击时直接查找
                };
                dispatch(addActivePacket(activePacket));
                // 自动选中当前飞行的数据包，右侧面板实时展示详情
                dispatch(setSelectedPacket(packet));

                // 激活发送方节点
                if (fromClient) {
                    dispatch(setClientActive(true));
                    setTimeout(() => {
                        if (isMountedRef.current) dispatch(setServerActive(true));
                    }, getAnimationDuration(ANIMATION_DURATION.STATE_TRANSITION));
                } else {
                    dispatch(setServerActive(true));
                    setTimeout(() => {
                        if (isMountedRef.current) dispatch(setClientActive(true));
                    }, getAnimationDuration(ANIMATION_DURATION.STATE_TRANSITION));
                }

                dispatch(setConnectionLineActive(true));

                const startTime = performance.now();

                const animate = (currentTime: number) => {
                    if (!isMountedRef.current) {
                        dispatch(removeActivePacket(packetId));
                        resolve();
                        return;
                    }

                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / adjustedDuration, 1);

                    // 使用easeInOut缓动
                    const easeProgress = progress < 0.5
                        ? 2 * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                    // 根据进度计算当前位置
                    const currentPos = calculatePacketPosition(
                        fromClient,
                        trackY,
                        easeProgress,
                        containerSize.width,
                        containerSize.height
                    );

                    dispatch(updateActivePacket({ id: packetId, position: currentPos }));

                    if (progress < 1) {
                        animationFrameRef.current = requestAnimationFrame(animate);
                    } else {
                        // 标记数据包完成
                        dispatch(completeActivePacket(packetId));

                        // 完成步骤
                        dispatch(updateTimelineStep({ id: stepId, active: false, completed: true }));

                        // 延迟后移除数据包
                        setTimeout(() => {
                            if (isMountedRef.current) {
                                dispatch(removeActivePacket(packetId));
                                dispatch(setClientActive(false));
                                dispatch(setServerActive(false));
                                dispatch(setConnectionLineActive(false));
                            }
                        }, ANIMATION_DURATION.PACKET_DISPLAY);

                        resolve();
                    }
                };

                animationFrameRef.current = requestAnimationFrame(animate);
            });
        },
        [dispatch, containerSize, getAnimationDuration]
    );

    // 执行三次握手动画
    const performHandshake = useCallback(async () => {
        if (!isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('handshake'));
        dispatch(setAnimationStatus('开始 TCP 三次握手...'));

        // 初始化状态
        dispatch(setClientState(TcpConnectionState.CLOSED));
        dispatch(setServerState(TcpConnectionState.LISTEN));

        try {
            let connection = TcpService.createConnection(
                DEFAULT_NETWORK_CONFIG.CLIENT_IP,
                DEFAULT_NETWORK_CONFIG.SERVER_IP,
                DEFAULT_NETWORK_CONFIG.CLIENT_PORT,
                DEFAULT_NETWORK_CONFIG.SERVER_PORT
            );

            // SYN - 客户端发起连接
            dispatch(setAnimationStatus('步骤 1/3: 客户端发送 SYN'));
            dispatch(setClientState(TcpConnectionState.SYN_SENT));

            const [connectionAfterSyn, synPackets] = TcpService.initiateHandshake(connection);
            connection = connectionAfterSyn;
            const synPacket = synPackets[0];

            dispatch(addPacketToHistory({
                id: `syn_${Date.now()}`,
                packet: synPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                true,  // 从客户端发送
                NETWORK_POSITIONS.TRACKS.SYN,
                'SYN',
                synPacket,
                'syn'
            );

            if (!isMountedRef.current) return;

            // SYN-ACK - 服务器响应
            dispatch(setAnimationStatus('步骤 2/3: 服务器发送 SYN-ACK'));
            dispatch(setServerState(TcpConnectionState.SYN_RECEIVED));

            const [connectionAfterSynAck, synAckPacket] = TcpService.handleSynAndSendSynAck(connection, synPacket);
            connection = connectionAfterSynAck;

            dispatch(addPacketToHistory({
                id: `syn_ack_${Date.now()}`,
                packet: synAckPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                false,  // 从服务端发送
                NETWORK_POSITIONS.TRACKS.SYN_ACK,
                'SYN-ACK',
                synAckPacket,
                'syn-ack'
            );

            if (!isMountedRef.current) return;

            // ACK - 客户端确认，连接建立
            dispatch(setAnimationStatus('步骤 3/3: 客户端发送 ACK，连接建立'));
            dispatch(setClientState(TcpConnectionState.ESTABLISHED));

            const [establishedConnection, ackPacket] = TcpService.handleSynAckAndSendAck(connection, synAckPacket);
            connection = establishedConnection;

            dispatch(addPacketToHistory({
                id: `ack_${Date.now()}`,
                packet: ackPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                true,  // 从客户端发送
                NETWORK_POSITIONS.TRACKS.HANDSHAKE_ACK,
                'ACK',
                ackPacket,
                'ack'
            );

            if (!isMountedRef.current) return;

            // 服务器收到ACK，连接建立
            dispatch(setServerState(TcpConnectionState.ESTABLISHED));
            dispatch(setConnection(connection));
            dispatch(setAnimationStatus('✅ TCP 三次握手完成！'));
            dispatch(setActiveLayers(['transport']));

            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    dispatch(setAnimationStatus(''));
                    dispatch(setActiveLayers([]));
                    dispatch(pause());
                }
            }, ANIMATION_DURATION.CLEANUP_DELAY);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            dispatch(setError({
                hasError: true,
                message: '三次握手失败',
                details: errorMessage,
                phase: 'handshake'
            }));
            dispatch(setAnimationStatus('❌ 三次握手失败'));
        }
    }, [dispatch, animatePacketMove]);

    // 执行数据传输动画
    const performDataTransfer = useCallback(async () => {
        const conn = connectionRef.current;
        if (!conn || !isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('data'));
        dispatch(setAnimationStatus('开始数据传输...'));

        // 确保状态为 ESTABLISHED
        dispatch(setClientState(TcpConnectionState.ESTABLISHED));
        dispatch(setServerState(TcpConnectionState.ESTABLISHED));

        try {
            const dataPayload = 'Hello Server!';

            // DATA - 客户端发送数据
            dispatch(setAnimationStatus('发送数据包到服务器'));
            const [updatedConnection, dataPacket] = TcpService.sendData(conn, dataPayload);

            dispatch(addPacketToHistory({
                id: `data_${Date.now()}`,
                packet: dataPacket,
                timestamp: Date.now(),
                phase: 'data'
            }));

            await animatePacketMove(
                true,  // 从客户端发送
                NETWORK_POSITIONS.TRACKS.DATA,
                'DATA',
                dataPacket,
                'data'
            );

            if (!isMountedRef.current) return;

            // ACK - 服务器确认收到
            dispatch(setAnimationStatus('服务器发送 ACK 确认'));
            const ackPacket = TcpService.sendAck(updatedConnection, dataPacket);

            dispatch(addPacketToHistory({
                id: `data_ack_${Date.now()}`,
                packet: ackPacket,
                timestamp: Date.now(),
                phase: 'data'
            }));

            await animatePacketMove(
                false,  // 从服务端发送
                NETWORK_POSITIONS.TRACKS.DATA_ACK,
                'ACK',
                ackPacket,
                'data-ack'
            );

            if (!isMountedRef.current) return;

            const finalConnection = TcpService.receiveData(updatedConnection, dataPacket);

            dispatch(setConnection(finalConnection));
            dispatch(setAnimationStatus('✅ 数据传输完成！'));
            dispatch(setActiveLayers(['application', 'transport']));

            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    dispatch(setAnimationStatus(''));
                    dispatch(setActiveLayers([]));
                    dispatch(pause());
                }
            }, ANIMATION_DURATION.CLEANUP_DELAY);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            dispatch(setError({
                hasError: true,
                message: '数据传输失败',
                details: errorMessage,
                phase: 'data'
            }));
            dispatch(setAnimationStatus('❌ 数据传输失败'));
        }
    }, [dispatch, animatePacketMove]);

    // 执行四次挥手动画
    const performClose = useCallback(async () => {
        const conn = connectionRef.current;
        if (!conn || !isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('close'));
        dispatch(setAnimationStatus('开始 TCP 四次挥手...'));

        // 确保状态为 ESTABLISHED
        dispatch(setClientState(TcpConnectionState.ESTABLISHED));
        dispatch(setServerState(TcpConnectionState.ESTABLISHED));

        try {
            let currentConnection = conn;

            // FIN 1 - 客户端发起关闭
            dispatch(setAnimationStatus('步骤 1/4: 客户端发送 FIN'));
            dispatch(setClientState(TcpConnectionState.FIN_WAIT_1));

            const [connAfterFin, finPacket] = TcpService.initiateClose(currentConnection);
            currentConnection = connAfterFin;

            dispatch(addPacketToHistory({
                id: `fin1_${Date.now()}`,
                packet: finPacket,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                true,  // 从客户端发送
                NETWORK_POSITIONS.TRACKS.FIN1,
                'FIN',
                finPacket,
                'fin1'
            );

            if (!isMountedRef.current) return;

            // ACK 1 - 服务器确认
            dispatch(setAnimationStatus('步骤 2/4: 服务器发送 ACK'));
            dispatch(setServerState(TcpConnectionState.CLOSE_WAIT));
            dispatch(setClientState(TcpConnectionState.FIN_WAIT_2));

            const [connAfterAck, ackPacket1] = TcpService.handleFinAndSendAck(
                { ...currentConnection, state: TcpConnectionState.ESTABLISHED },
                finPacket
            );
            currentConnection = { ...currentConnection, state: TcpConnectionState.FIN_WAIT_2 };

            dispatch(addPacketToHistory({
                id: `ack1_${Date.now()}`,
                packet: ackPacket1,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                false,  // 从服务端发送
                NETWORK_POSITIONS.TRACKS.FIN1_ACK,
                'ACK',
                ackPacket1,
                'ack1'
            );

            if (!isMountedRef.current) return;

            // FIN 2 - 服务器发起关闭
            dispatch(setAnimationStatus('步骤 3/4: 服务器发送 FIN'));
            dispatch(setServerState(TcpConnectionState.LAST_ACK));

            const [connAfterServerFin, serverFinPacket] = TcpService.sendFinalFin(connAfterAck);
            currentConnection = { ...currentConnection, state: TcpConnectionState.TIME_WAIT };

            dispatch(addPacketToHistory({
                id: `fin2_${Date.now()}`,
                packet: serverFinPacket,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                false,  // 从服务端发送
                NETWORK_POSITIONS.TRACKS.FIN2,
                'FIN',
                serverFinPacket,
                'fin2'
            );

            if (!isMountedRef.current) return;

            // ACK 2 - 客户端最终确认
            dispatch(setAnimationStatus('步骤 4/4: 客户端发送最终 ACK'));
            dispatch(setClientState(TcpConnectionState.TIME_WAIT));

            const ackPacket2: NetworkPacket = {
                id: `final_ack_${Date.now()}`,
                source: `${currentConnection.sourceIp}:${currentConnection.sourcePort}`,
                destination: `${currentConnection.destinationIp}:${currentConnection.destinationPort}`,
                payload: 'ACK',
                timestamp: Date.now(),
                tcpHeader: {
                    sourcePort: currentConnection.sourcePort,
                    destinationPort: currentConnection.destinationPort,
                    sequenceNumber: currentConnection.localSeqNum,
                    acknowledgmentNumber: currentConnection.remoteAckNum,
                    headerLength: 5,
                    flags: TcpFlags.ACK,
                    windowSize: currentConnection.windowSize,
                    checksum: 0,
                    urgentPointer: 0,
                },
                layer: 'transport',
                direction: 'request',
            };

            dispatch(addPacketToHistory({
                id: `ack2_${Date.now()}`,
                packet: ackPacket2,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                true,  // 从客户端发送
                NETWORK_POSITIONS.TRACKS.FIN2_ACK,
                'ACK',
                ackPacket2,
                'ack2'
            );

            if (!isMountedRef.current) return;

            // 连接关闭
            dispatch(setServerState(TcpConnectionState.CLOSED));

            // 等待 2MSL 后客户端也关闭
            await new Promise(resolve => setTimeout(resolve, 1000));
            dispatch(setClientState(TcpConnectionState.CLOSED));

            dispatch(setConnection(null));
            dispatch(setAnimationStatus('✅ TCP 四次挥手完成，连接已关闭！'));
            dispatch(setActiveLayers([]));

            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    dispatch(setAnimationStatus(''));
                    dispatch(pause());
                }
            }, ANIMATION_DURATION.CLEANUP_DELAY);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            dispatch(setError({
                hasError: true,
                message: '四次挥手失败',
                details: errorMessage,
                phase: 'close'
            }));
            dispatch(setAnimationStatus('❌ 四次挥手失败'));
        }
    }, [dispatch, animatePacketMove]);

    // 重置连接
    const resetConnection = useCallback(() => {
        cleanupAnimation();
        dispatch(clearActivePackets());
        dispatch(reset());
    }, [dispatch, cleanupAnimation]);

    // 清除错误
    const clearErrorState = useCallback(() => {
        dispatch(clearError());
    }, [dispatch]);

    // 重试失败的阶段
    const retryFailedPhase = useCallback(() => {
        if (!error.phase) return;
        dispatch(clearError());
        switch (error.phase) {
            case 'handshake':
                performHandshake();
                break;
            case 'data':
                performDataTransfer();
                break;
            case 'close':
                performClose();
                break;
        }
    }, [dispatch, error.phase, performHandshake, performDataTransfer, performClose]);

    // 一键完整演示：握手 → 发数据 → 挥手
    const performFullFlow = useCallback(async () => {
        if (fullFlowActive || !isMountedRef.current) return;
        // 先清空重置，避免残留状态干扰
        dispatch(clearActivePackets());
        dispatch(reset());
        dispatch(setFullFlowActive(true));
        dispatch(clearError());

        try {
            // 握手
            await performHandshake();
            if (!isMountedRef.current) return;
            // 等待一下让用户看清连接建立状态
            await new Promise(resolve => setTimeout(resolve, 800));

            // 发数据
            await performDataTransfer();
            if (!isMountedRef.current) return;
            await new Promise(resolve => setTimeout(resolve, 800));

            // 挥手
            await performClose();
        } finally {
            dispatch(setFullFlowActive(false));
        }
    }, [fullFlowActive, performHandshake, performDataTransfer, performClose, dispatch]);

    // 确保组件挂载时 isMountedRef 为 true
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            cleanupAnimation();
        };
    }, [cleanupAnimation]);

    return {
        connection,
        isPlaying,
        fullFlowActive,
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
        performFullFlow,
        resetConnection,
        clearErrorState,
        retryFailedPhase,
        cleanupAnimation,
        updateContainerSize,
        selectPacket,
    };
};