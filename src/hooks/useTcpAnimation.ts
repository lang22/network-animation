import { useCallback, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
    setConnection,
    setAnimationStatus,
    reset,
    play,
    pause,
    setAnimationUI,
    setPacketPosition,
    setPacketType,
    setActiveLayers,
    setClientActive,
    setServerActive,
    setConnectionLineActive,
    setContainerSize,
    addPacketToHistory,
    setSelectedPacket,
    setCurrentPhase,
    updateTimelineStep,
} from '@/store/slices/simulationSlice';
import { TcpService } from '@/services/protocols/tcpService';
import { TcpConnection, TcpConnectionState, NetworkPacket } from '@/types/networkTypes';
import {
    NETWORK_POSITIONS,
    PACKET_TYPES,
    ANIMATION_DURATION,
    DEFAULT_NETWORK_CONFIG,
    PacketType,
} from '@/utils/constants';

export const useTcpAnimation = () => {
    const dispatch = useAppDispatch();
    const {
        connection,
        isPlaying,
        animationStatus,
        animationUI,
        packetHistory,
        selectedPacket,
        currentPhase,
        timelineSteps
    } = useAppSelector((state) => state.simulation);

    const animationFrameRef = useRef<number | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);

    const containerSize = animationUI.containerSize;

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
            startXPercent: number,
            startYPercent: number,
            endXPercent: number,
            endYPercent: number,
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

                const startPos = {
                    x: (containerSize.width * startXPercent) / 100,
                    y: (containerSize.height * startYPercent) / 100,
                };
                const endPos = {
                    x: (containerSize.width * endXPercent) / 100,
                    y: (containerSize.height * endYPercent) / 100,
                };

                // 设置当前步骤为 active
                dispatch(updateTimelineStep({ id: stepId, active: true }));
                dispatch(setPacketPosition(startPos));
                dispatch(setPacketType(packetType));
                dispatch(setPacketType(packetType));

                // 激活节点状态
                if (startPos.x < endPos.x) {
                    dispatch(setClientActive(true));
                    setTimeout(() => {
                        if (isMountedRef.current) dispatch(setServerActive(true));
                    }, ANIMATION_DURATION.STATE_TRANSITION);
                } else {
                    dispatch(setServerActive(true));
                    setTimeout(() => {
                        if (isMountedRef.current) dispatch(setClientActive(true));
                    }, ANIMATION_DURATION.STATE_TRANSITION);
                }

                dispatch(setConnectionLineActive(true));

                const startTime = performance.now();

                const animate = (currentTime: number) => {
                    if (!isMountedRef.current) {
                        resolve();
                        return;
                    }

                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    const currentX = startPos.x + (endPos.x - startPos.x) * progress;
                    const currentY = startPos.y + (endPos.y - startPos.y) * progress;

                    dispatch(setPacketPosition({ x: currentX, y: currentY }));

                    if (progress < 1) {
                        animationFrameRef.current = requestAnimationFrame(animate);
                    } else {
                        // 完成步骤
                        dispatch(updateTimelineStep({ id: stepId, active: false, completed: true }));

                        setTimeout(() => {
                            if (isMountedRef.current) {
                                dispatch(setClientActive(false));
                                dispatch(setServerActive(false));
                                dispatch(setConnectionLineActive(false));
                            }
                        }, ANIMATION_DURATION.STATE_TRANSITION);
                        resolve();
                    }
                };

                animationFrameRef.current = requestAnimationFrame(animate);
            });
        },
        [dispatch, containerSize]
    );

    // 执行三次握手动画
    const performHandshake = useCallback(async () => {
        if (!isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('handshake'));
        dispatch(setAnimationStatus('开始 TCP 三次握手...'));

        try {
            let connection = TcpService.createConnection(
                DEFAULT_NETWORK_CONFIG.CLIENT_IP,
                DEFAULT_NETWORK_CONFIG.SERVER_IP,
                DEFAULT_NETWORK_CONFIG.CLIENT_PORT,
                DEFAULT_NETWORK_CONFIG.SERVER_PORT
            );

            // SYN
            dispatch(setAnimationStatus('步骤 1/3: 客户端发送 SYN'));
            const synPackets = TcpService.initiateHandshake(connection);
            const synPacket = synPackets[0];

            dispatch(addPacketToHistory({
                id: `syn_${Date.now()}`,
                packet: synPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                'SYN',
                synPacket,
                'syn'
            );

            if (!isMountedRef.current) return;

            // SYN-ACK
            dispatch(setAnimationStatus('步骤 2/3: 服务器发送 SYN-ACK'));
            const [connectionAfterSyn, synAckPacket] = TcpService.handleSynAndSendSynAck(connection, synPacket);
            connection = connectionAfterSyn;

            dispatch(addPacketToHistory({
                id: `syn_ack_${Date.now()}`,
                packet: synAckPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                'SYN-ACK',
                synAckPacket,
                'syn-ack'
            );

            if (!isMountedRef.current) return;

            // ACK
            dispatch(setAnimationStatus('步骤 3/3: 客户端发送 ACK，连接建立'));
            const [establishedConnection, ackPacket] = TcpService.handleSynAckAndSendAck(connection, synAckPacket);
            connection = establishedConnection;

            dispatch(addPacketToHistory({
                id: `ack_${Date.now()}`,
                packet: ackPacket,
                timestamp: Date.now(),
                phase: 'handshake'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.HANDSHAKE_Y_PERCENT,
                'ACK',
                ackPacket,
                'ack'
            );

            if (!isMountedRef.current) return;

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
            console.error('握手动画失败:', error);
            dispatch(setAnimationStatus('❌ 动画执行失败'));
            dispatch(pause());
        }
    }, [dispatch, animatePacketMove]);

    // 执行数据传输动画
    const performDataTransfer = useCallback(async () => {
        if (!connection || !isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('data'));
        dispatch(setAnimationStatus('开始数据传输...'));

        try {
            const dataPayload = 'Hello Server!';

            // DATA
            dispatch(setAnimationStatus('发送数据包到服务器'));
            const [updatedConnection, dataPacket] = TcpService.sendData(connection, dataPayload);

            dispatch(addPacketToHistory({
                id: `data_${Date.now()}`,
                packet: dataPacket,
                timestamp: Date.now(),
                phase: 'data'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.DATA_TRANSFER_Y_PERCENT,
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.DATA_TRANSFER_Y_PERCENT,
                'DATA',
                dataPacket,
                'data'
            );

            if (!isMountedRef.current) return;

            // ACK
            dispatch(setAnimationStatus('服务器发送 ACK 确认'));
            const ackPacket = TcpService.sendAck(updatedConnection, dataPacket);

            dispatch(addPacketToHistory({
                id: `data_ack_${Date.now()}`,
                packet: ackPacket,
                timestamp: Date.now(),
                phase: 'data'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.DATA_TRANSFER_Y_PERCENT,
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.DATA_TRANSFER_Y_PERCENT,
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
            console.error('数据传输动画失败:', error);
            dispatch(setAnimationStatus('❌ 动画执行失败'));
            dispatch(pause());
        }
    }, [connection, dispatch, animatePacketMove]);

    // 执行四次挥手动画
    const performClose = useCallback(async () => {
        if (!connection || !isMountedRef.current) return;

        dispatch(play());
        dispatch(setCurrentPhase('close'));
        dispatch(setAnimationStatus('开始 TCP 四次挥手...'));

        try {
            let currentConnection = connection;

            // FIN 1
            dispatch(setAnimationStatus('步骤 1/4: 客户端发送 FIN'));
            const [connAfterFin, finPacket] = TcpService.initiateClose(currentConnection);
            currentConnection = connAfterFin;

            dispatch(addPacketToHistory({
                id: `fin1_${Date.now()}`,
                packet: finPacket,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                'FIN',
                finPacket,
                'fin1'
            );

            if (!isMountedRef.current) return;

            // ACK 1
            dispatch(setAnimationStatus('步骤 2/4: 服务器发送 ACK'));
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
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                'ACK',
                ackPacket1,
                'ack1'
            );

            if (!isMountedRef.current) return;

            // FIN 2
            dispatch(setAnimationStatus('步骤 3/4: 服务器发送 FIN'));
            const [connAfterServerFin, serverFinPacket] = TcpService.sendFinalFin(connAfterAck);
            currentConnection = { ...currentConnection, state: TcpConnectionState.TIME_WAIT };

            dispatch(addPacketToHistory({
                id: `fin2_${Date.now()}`,
                packet: serverFinPacket,
                timestamp: Date.now(),
                phase: 'close'
            }));

            await animatePacketMove(
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                'FIN',
                serverFinPacket,
                'fin2'
            );

            if (!isMountedRef.current) return;

            // ACK 2
            dispatch(setAnimationStatus('步骤 4/4: 客户端发送最终 ACK'));
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
                    acknowledgmentNumber: serverFinPacket.tcpHeader!.sequenceNumber + 1,
                    headerLength: 5,
                    flags: 16,
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
                NETWORK_POSITIONS.CLIENT.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                NETWORK_POSITIONS.SERVER.xPercent,
                NETWORK_POSITIONS.CLOSE_Y_PERCENT,
                'ACK',
                ackPacket2,
                'ack2'
            );

            if (!isMountedRef.current) return;

            const closedConnection: TcpConnection = {
                ...currentConnection,
                state: TcpConnectionState.CLOSED,
            };

            dispatch(setConnection(closedConnection));
            dispatch(setAnimationStatus('✅ TCP 四次挥手完成，连接已关闭！'));
            dispatch(setActiveLayers(['application', 'transport', 'network', 'link']));

            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    dispatch(setAnimationStatus(''));
                    dispatch(setActiveLayers([]));
                    dispatch(pause());
                }
            }, ANIMATION_DURATION.CLEANUP_DELAY);
        } catch (error) {
            console.error('关闭动画失败:', error);
            dispatch(setAnimationStatus('❌ 动画执行失败'));
            dispatch(pause());
        }
    }, [connection, dispatch, animatePacketMove]);

    // 重置连接
    const resetConnection = useCallback(() => {
        cleanupAnimation();
        dispatch(reset());
    }, [dispatch, cleanupAnimation]);

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
        cleanupAnimation,
        updateContainerSize,
        selectPacket,
    };
};