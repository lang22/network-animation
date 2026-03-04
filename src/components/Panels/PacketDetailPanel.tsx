import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { NetworkPacket } from '@/types/networkTypes';
import { TcpFlags } from '@/types/networkTypes';

const PanelContainer = styled.div`
    background: linear-gradient(180deg, ${darkTheme.colors.surface} 0%, ${darkTheme.colors.surfaceLight} 100%);
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    overflow: hidden;
`;

const PanelHeader = styled.div`
    padding: 12px 16px;
    background: ${darkTheme.colors.surfaceLight};
    border-bottom: 1px solid ${darkTheme.colors.border};
    display: flex;
    align-items: center;
    gap: 8px;
`;

const PanelIcon = styled.span`
    font-size: 16px;
`;

const PanelTitle = styled.h4`
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
`;

const PanelContent = styled.div`
    padding: 16px;
`;

const EmptyState = styled.div`
    text-align: center;
    padding: 20px;
    color: ${darkTheme.colors.textMuted};
    font-size: 13px;
`;

const PacketInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const InfoRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid ${darkTheme.colors.border};

    &:last-child {
        border-bottom: none;
    }
`;

const InfoLabel = styled.span`
    font-size: 12px;
    color: ${darkTheme.colors.textMuted};
`;

const InfoValue = styled.span`
    font-size: 12px;
    color: ${darkTheme.colors.text};
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
`;

const Section = styled.div`
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid ${darkTheme.colors.border};
`;

const SectionTitle = styled.h5`
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 600;
    color: ${darkTheme.colors.primary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const FlagsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
`;

const FlagBadge = styled.span<{ $active?: boolean }>`
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    background: ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.surfaceLight};
    color: ${({ $active }) => $active ? darkTheme.colors.background : darkTheme.colors.textMuted};
    border: 1px solid ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.border};
`;

interface PacketDetailPanelProps {
    packet: NetworkPacket | null;
}

const getFlagsArray = (flags: TcpFlags): { name: string; active: boolean }[] => {
    return [
        { name: 'SYN', active: !!(flags & TcpFlags.SYN) },
        { name: 'ACK', active: !!(flags & TcpFlags.ACK) },
        { name: 'FIN', active: !!(flags & TcpFlags.FIN) },
        { name: 'RST', active: !!(flags & TcpFlags.RST) },
        { name: 'PSH', active: !!(flags & TcpFlags.PSH) },
        { name: 'URG', active: !!(flags & TcpFlags.URG) },
    ];
};

const PacketDetailPanel: React.FC<PacketDetailPanelProps> = ({ packet }) => {
    if (!packet) {
        return (
            <PanelContainer>
                <PanelHeader>
                    <PanelIcon>📦</PanelIcon>
                    <PanelTitle>数据包详情</PanelTitle>
                </PanelHeader>
                <PanelContent>
                    <EmptyState>
                        点击数据包查看详细信息
                    </EmptyState>
                </PanelContent>
            </PanelContainer>
        );
    }

    const flags = packet.tcpHeader?.flags ? getFlagsArray(packet.tcpHeader.flags) : [];

    return (
        <PanelContainer>
            <PanelHeader>
                <PanelIcon>📦</PanelIcon>
                <PanelTitle>数据包详情</PanelTitle>
            </PanelHeader>
            <PanelContent>
                <PacketInfo>
                    <InfoRow>
                        <InfoLabel>类型</InfoLabel>
                        <InfoValue style={{ color: darkTheme.colors.primary }}>{packet.payload}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>方向</InfoLabel>
                        <InfoValue>{packet.direction === 'request' ? '请求 →' : '← 响应'}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>源地址</InfoLabel>
                        <InfoValue>{packet.source}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>目标地址</InfoLabel>
                        <InfoValue>{packet.destination}</InfoValue>
                    </InfoRow>

                    {packet.tcpHeader && (
                        <Section>
                            <SectionTitle>TCP 头部</SectionTitle>
                            <InfoRow>
                                <InfoLabel>源端口</InfoLabel>
                                <InfoValue>{packet.tcpHeader.sourcePort}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>目的端口</InfoLabel>
                                <InfoValue>{packet.tcpHeader.destinationPort}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>序列号</InfoLabel>
                                <InfoValue>{packet.tcpHeader.sequenceNumber}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>确认号</InfoLabel>
                                <InfoValue>{packet.tcpHeader.acknowledgmentNumber}</InfoValue>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>窗口大小</InfoLabel>
                                <InfoValue>{packet.tcpHeader.windowSize}</InfoValue>
                            </InfoRow>

                            <div style={{ marginTop: '8px' }}>
                                <InfoLabel style={{ marginBottom: '6px', display: 'block' }}>标志位</InfoLabel>
                                <FlagsContainer>
                                    {flags.map(flag => (
                                        <FlagBadge key={flag.name} $active={flag.active}>
                                            {flag.name}
                                        </FlagBadge>
                                    ))}
                                </FlagsContainer>
                            </div>
                        </Section>
                    )}
                </PacketInfo>
            </PanelContent>
        </PanelContainer>
    );
};

export default PacketDetailPanel;