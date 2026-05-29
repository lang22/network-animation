import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { TcpConnectionState } from '@/types/networkTypes';

// ==================== 容器 ====================
const DiagramContainer = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
`;

const SideTitle = styled.div`
    font-size: 9px;
    font-weight: 700;
    color: ${darkTheme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

// ==================== 状态流 ====================
const StateFlow = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const StateRow = styled.div<{ $active?: boolean; $side: 'client' | 'server' }>`
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-weight: ${({ $active }) => $active ? 700 : 400};
    color: ${({ $active, $side }) =>
        $active ? darkTheme.colors.text : darkTheme.colors.textMuted};
    background: ${({ $active, $side }) =>
        $active
            ? $side === 'client'
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(59, 130, 246, 0.12)'
            : 'transparent'};
    border-left: 2px solid ${({ $active, $side }) =>
        $active
            ? $side === 'client'
                ? darkTheme.nodeColors.client.glow
                : darkTheme.nodeColors.server.glow
            : 'transparent'};
    transition: all 0.3s ease;

    &::before {
        content: '${({ $active }) => $active ? '●' : '○'}';
        font-size: 6px;
        color: ${({ $active, $side }) =>
            $active
                ? $side === 'client'
                    ? '#4ade80'
                    : '#60a5fa'
                : darkTheme.colors.border};
    }
`;

const ArrowLabel = styled.div`
    font-size: 7px;
    color: ${darkTheme.colors.textMuted};
    padding: 1px 12px;
    opacity: 0.5;
`;

// ==================== 状态路径定义 ====================
const CLIENT_PATH: TcpConnectionState[] = [
    TcpConnectionState.CLOSED,
    TcpConnectionState.SYN_SENT,
    TcpConnectionState.ESTABLISHED,
    TcpConnectionState.FIN_WAIT_1,
    TcpConnectionState.FIN_WAIT_2,
    TcpConnectionState.TIME_WAIT,
    TcpConnectionState.CLOSED,
];

const SERVER_PATH: TcpConnectionState[] = [
    TcpConnectionState.CLOSED,
    TcpConnectionState.LISTEN,
    TcpConnectionState.SYN_RECEIVED,
    TcpConnectionState.ESTABLISHED,
    TcpConnectionState.CLOSE_WAIT,
    TcpConnectionState.LAST_ACK,
    TcpConnectionState.CLOSED,
];

const getShortName = (state: TcpConnectionState): string => {
    const map: Record<string, string> = {
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
    return map[state] || state;
};

// ==================== Props ====================
interface TcpStateDiagramProps {
    clientState: TcpConnectionState | null;
    serverState: TcpConnectionState | null;
}

const TcpStateDiagram: React.FC<TcpStateDiagramProps> = ({ clientState, serverState }) => {
    return (
        <DiagramContainer>
            <SideTitle>客户端状态</SideTitle>
            <StateFlow>
                {CLIENT_PATH.map((state, i) => (
                    <React.Fragment key={`c_${state}`}>
                        <StateRow
                            $active={clientState === state}
                            $side="client"
                        >
                            {getShortName(state)}
                        </StateRow>
                        {i < CLIENT_PATH.length - 1 && (
                            <ArrowLabel>↓</ArrowLabel>
                        )}
                    </React.Fragment>
                ))}
            </StateFlow>

            <SideTitle style={{ marginTop: '4px' }}>服务端状态</SideTitle>
            <StateFlow>
                {SERVER_PATH.map((state, i) => (
                    <React.Fragment key={`s_${state}`}>
                        <StateRow
                            $active={serverState === state}
                            $side="server"
                        >
                            {getShortName(state)}
                        </StateRow>
                        {i < SERVER_PATH.length - 1 && (
                            <ArrowLabel>↓</ArrowLabel>
                        )}
                    </React.Fragment>
                ))}
            </StateFlow>
        </DiagramContainer>
    );
};

export default TcpStateDiagram;
