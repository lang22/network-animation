import simulationSlice, {
    play,
    pause,
    setConnection,
    setAnimationStatus,
    setError,
    clearError,
    reset,
    setCurrentPhase,
    addPacketToHistory,
    setSelectedPacket,
    updateTimelineStep,
    TimelineStep,
    ErrorState,
    AnimationUIState,
    SimulationState,
} from '../simulationSlice';
import { TcpConnectionState } from '@/types/networkTypes';

describe('simulationSlice', () => {
    const initialAnimationUI: AnimationUIState = {
        clientActive: false,
        serverActive: false,
        connectionLineActive: false,
        activePackets: [],
        activeLayers: [],
        containerSize: { width: 800, height: 600 },
        clientState: null,
        serverState: null,
    };

    const initialState: SimulationState = {
        isPlaying: false,
        connection: null,
        animationStatus: '',
        animationUI: initialAnimationUI,
        packetHistory: [],
        selectedPacket: null,
        currentPhase: 'idle',
        timelineSteps: [],
        error: { hasError: false, message: '' },
    };

    describe('play and pause', () => {
        it('should set isPlaying to true', () => {
            const state = simulationSlice(initialState, play());
            expect(state.isPlaying).toBe(true);
        });

        it('should set isPlaying to false', () => {
            const playingState = { ...initialState, isPlaying: true };
            const state = simulationSlice(playingState, pause());
            expect(state.isPlaying).toBe(false);
        });
    });

    describe('setConnection', () => {
        it('should set connection', () => {
            const mockConnection = {
                id: 'conn_123',
                sourceIp: '192.168.1.10',
                destinationIp: '192.168.1.20',
                sourcePort: 54321,
                destinationPort: 80,
                state: TcpConnectionState.ESTABLISHED,
                localSeqNum: 100,
                remoteSeqNum: 200,
                localAckNum: 201,
                remoteAckNum: 101,
                windowSize: 65535,
                rtt: 0,
            };
            const state = simulationSlice(initialState, setConnection(mockConnection));
            expect(state.connection).toEqual(mockConnection);
        });

        it('should clear connection when set to null', () => {
            const stateWithConnection = {
                ...initialState,
                connection: {
                    id: 'conn_123',
                    sourceIp: '192.168.1.10',
                    destinationIp: '192.168.1.20',
                    sourcePort: 54321,
                    destinationPort: 80,
                    state: TcpConnectionState.ESTABLISHED,
                    localSeqNum: 100,
                    remoteSeqNum: 200,
                    localAckNum: 201,
                    remoteAckNum: 101,
                    windowSize: 65535,
                    rtt: 0,
                },
            };
            const state = simulationSlice(stateWithConnection, setConnection(null));
            expect(state.connection).toBeNull();
        });
    });

    describe('setAnimationStatus', () => {
        it('should set animation status', () => {
            const state = simulationSlice(initialState, setAnimationStatus('开始握手'));
            expect(state.animationStatus).toBe('开始握手');
        });
    });

    describe('error handling', () => {
        it('should set error state', () => {
            const errorPayload: ErrorState = {
                hasError: true,
                message: '握手失败',
                details: '连接超时',
                phase: 'handshake',
            };
            const state = simulationSlice(initialState, setError(errorPayload));
            expect(state.error).toEqual(errorPayload);
            expect(state.isPlaying).toBe(false);
        });

        it('should clear error state', () => {
            const stateWithError = {
                ...initialState,
                error: {
                    hasError: true,
                    message: '握手失败',
                    details: '连接超时',
                },
            };
            const state = simulationSlice(stateWithError, clearError());
            expect(state.error).toEqual({ hasError: false, message: '' });
        });
    });

    describe('setCurrentPhase', () => {
        it('should set handshake phase and timeline steps', () => {
            const state = simulationSlice(initialState, setCurrentPhase('handshake'));
            expect(state.currentPhase).toBe('handshake');
            expect(state.timelineSteps).toHaveLength(3);
            expect(state.timelineSteps[0].id).toBe('syn');
        });

        it('should set data phase and timeline steps', () => {
            const state = simulationSlice(initialState, setCurrentPhase('data'));
            expect(state.currentPhase).toBe('data');
            expect(state.timelineSteps).toHaveLength(2);
        });

        it('should set close phase and timeline steps', () => {
            const state = simulationSlice(initialState, setCurrentPhase('close'));
            expect(state.currentPhase).toBe('close');
            expect(state.timelineSteps).toHaveLength(4);
        });

        it('should clear timeline steps for idle phase', () => {
            const stateWithSteps = {
                ...initialState,
                timelineSteps: [{ id: 'test', label: 'Test', completed: false, active: false }],
            };
            const state = simulationSlice(stateWithSteps, setCurrentPhase('idle'));
            expect(state.timelineSteps).toHaveLength(0);
        });
    });

    describe('updateTimelineStep', () => {
        it('should update timeline step', () => {
            const stateWithSteps = {
                ...initialState,
                timelineSteps: [
                    { id: 'syn', label: 'SYN', completed: false, active: false },
                    { id: 'syn-ack', label: 'SYN-ACK', completed: false, active: false },
                ] as TimelineStep[],
            };
            const state = simulationSlice(
                stateWithSteps,
                updateTimelineStep({ id: 'syn', completed: true, active: true })
            );
            const synStep = state.timelineSteps.find(s => s.id === 'syn');
            expect(synStep?.completed).toBe(true);
            expect(synStep?.active).toBe(true);
        });

        it('should not modify other steps', () => {
            const stateWithSteps = {
                ...initialState,
                timelineSteps: [
                    { id: 'syn', label: 'SYN', completed: false, active: false },
                    { id: 'syn-ack', label: 'SYN-ACK', completed: false, active: false },
                ] as TimelineStep[],
            };
            const state = simulationSlice(
                stateWithSteps,
                updateTimelineStep({ id: 'syn', completed: true })
            );
            const synAckStep = state.timelineSteps.find(s => s.id === 'syn-ack');
            expect(synAckStep?.completed).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset all state to initial', () => {
            const modifiedState: SimulationState = {
                isPlaying: true,
                connection: {
                    id: 'conn_123',
                    sourceIp: '192.168.1.10',
                    destinationIp: '192.168.1.20',
                    sourcePort: 54321,
                    destinationPort: 80,
                    state: TcpConnectionState.ESTABLISHED,
                    localSeqNum: 100,
                    remoteSeqNum: 200,
                    localAckNum: 201,
                    remoteAckNum: 101,
                    windowSize: 65535,
                    rtt: 0,
                },
                animationStatus: '已连接',
                animationUI: {
                    clientActive: true,
                    serverActive: true,
                    connectionLineActive: true,
                    activePackets: [{
                        id: 'packet_1',
                        type: 'ACK',
                        position: { x: 100, y: 200 },
                        targetPosition: { x: 300, y: 200 },
                        startTime: Date.now(),
                        duration: 1000,
                        completed: false,
                        direction: 'right',
                    }],
                    activeLayers: ['transport'],
                    containerSize: { width: 1000, height: 800 },
                    clientState: TcpConnectionState.ESTABLISHED,
                    serverState: TcpConnectionState.ESTABLISHED,
                },
                packetHistory: [{ id: 'pkt_1', packet: {} as any, timestamp: Date.now(), phase: 'handshake' }],
                selectedPacket: {} as any,
                currentPhase: 'handshake',
                timelineSteps: [{ id: 'syn', label: 'SYN', completed: true, active: false }],
                error: { hasError: true, message: '错误' },
            };
            const state = simulationSlice(modifiedState, reset());
            expect(state).toEqual(initialState);
        });
    });

    describe('addPacketToHistory', () => {
        it('should add packet to history', () => {
            const packet = {
                id: 'pkt_test',
                source: '192.168.1.10:54321',
                destination: '192.168.1.20:80',
                payload: 'SYN',
                timestamp: Date.now(),
                layer: 'transport' as const,
                direction: 'request' as const,
            };
            const state = simulationSlice(initialState, addPacketToHistory({
                id: 'history_1',
                packet,
                timestamp: Date.now(),
                phase: 'handshake',
            }));
            expect(state.packetHistory).toHaveLength(1);
            expect(state.packetHistory[0].packet).toEqual(packet);
        });
    });

    describe('setSelectedPacket', () => {
        it('should set selected packet', () => {
            const packet = {
                id: 'pkt_test',
                source: '192.168.1.10:54321',
                destination: '192.168.1.20:80',
                payload: 'SYN',
                timestamp: Date.now(),
                layer: 'transport' as const,
                direction: 'request' as const,
            };
            const state = simulationSlice(initialState, setSelectedPacket(packet));
            expect(state.selectedPacket).toEqual(packet);
        });

        it('should clear selected packet', () => {
            const stateWithPacket = {
                ...initialState,
                selectedPacket: { id: 'pkt_test' } as any,
            };
            const state = simulationSlice(stateWithPacket, setSelectedPacket(null));
            expect(state.selectedPacket).toBeNull();
        });
    });
});