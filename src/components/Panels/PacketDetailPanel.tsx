import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';
import { NetworkPacket, TcpFlags } from '@/types/networkTypes';

// ==================== 空状态 ====================
const EmptyState = styled.div`
    text-align: center;
    padding: 40px 20px;
    color: ${darkTheme.colors.textMuted};
    font-size: 13px;
    line-height: 1.6;
`;

const EmptyIcon = styled.div`
    font-size: 40px;
    margin-bottom: 12px;
    opacity: 0.4;
`;

// ==================== 信息行 ====================
const InfoGrid = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const InfoRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 10px;
    border-radius: 4px;
    background: rgba(255,255,255,0.02);
    transition: background 0.15s;

    &:hover {
        background: rgba(255,255,255,0.04);
    }
`;

const InfoLabel = styled.span`
    font-size: 12px;
    color: ${darkTheme.colors.textMuted};
    flex-shrink: 0;
`;

const InfoValue = styled.span`
    font-size: 12px;
    color: ${darkTheme.colors.text};
    font-weight: 500;
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    text-align: right;
    word-break: break-all;
    margin-left: 12px;
`;

const InfoValueHighlight = styled(InfoValue)`
    color: ${darkTheme.colors.primary};
    font-weight: 600;
`;

// ==================== 分区 ====================
const Section = styled.div`
    margin-top: 12px;
`;

const SectionTitle = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: ${darkTheme.colors.primary};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 6px;

    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: ${darkTheme.colors.border};
    }
`;

// ==================== 标志位 ====================
const FlagsContainer = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 10px;
`;

const FlagBadge = styled.span<{ $active?: boolean }>`
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    background: ${({ $active }) => $active ? 'rgba(0, 212, 255, 0.15)' : darkTheme.colors.surfaceLight};
    color: ${({ $active }) => $active ? darkTheme.colors.primary : darkTheme.colors.textMuted};
    border: 1px solid ${({ $active }) => $active ? 'rgba(0, 212, 255, 0.3)' : darkTheme.colors.border};
    transition: all 0.2s;
`;

// ==================== 载荷预览 ====================
const PayloadBox = styled.div`
    margin: 8px 10px 0;
    padding: 10px 12px;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    border: 1px solid ${darkTheme.colors.border};
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: ${darkTheme.colors.text};
    word-break: break-all;
    line-height: 1.5;
`;

const PayloadLabel = styled.div`
    font-size: 9px;
    color: ${darkTheme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
`;

// ==================== 方向徽章 ====================
const DirectionBadge = styled.span<{ $direction: 'request' | 'response' }>`
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    background: ${({ $direction }) =>
        $direction === 'request'
            ? 'rgba(0, 212, 255, 0.12)'
            : 'rgba(139, 92, 246, 0.12)'};
    color: ${({ $direction }) =>
        $direction === 'request' ? '#38bdf8' : '#a78bfa'};
`;

// ==================== Props & Helpers ====================
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

const formatTime = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
};

/** 根据 TCP 标志位推断数据包类型名称 */
const getPacketTypeName = (packet: NetworkPacket): string => {
    const flags = packet.tcpHeader?.flags;
    if (flags !== undefined) {
        if ((flags & TcpFlags.SYN) && (flags & TcpFlags.ACK)) return 'SYN-ACK';
        if (flags & TcpFlags.SYN) return 'SYN';
        if (flags & TcpFlags.FIN) return 'FIN';
        if (flags & TcpFlags.ACK) {
            // 纯 ACK 可能是握手ACK或数据ACK
            return String(packet.payload) === 'ACK' ? 'ACK' : 'DATA';
        }
    }
    return String(packet.payload);
};

const PacketDetailPanel: React.FC<PacketDetailPanelProps> = ({ packet }) => {
    if (!packet) {
        return (
            <EmptyState>
                <EmptyIcon>📦</EmptyIcon>
                <div>点击飞行中的数据包</div>
                <div>或端点盒子中已接收的包</div>
                <div>查看详细信息</div>
            </EmptyState>
        );
    }

    const flags = packet.tcpHeader?.flags !== undefined ? getFlagsArray(packet.tcpHeader.flags) : [];
    const hasIpHeader = !!packet.ipHeader;
    const hasTcpHeader = !!packet.tcpHeader;
    const hasEthernet = !!packet.ethernetHeader;

    return (
        <div>
            {/* 基本概要 */}
            <SectionTitle>概要</SectionTitle>
            <InfoGrid>
                <InfoRow>
                    <InfoLabel>类型</InfoLabel>
                    <InfoValueHighlight>{getPacketTypeName(packet)}</InfoValueHighlight>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>方向</InfoLabel>
                    <DirectionBadge $direction={packet.direction}>
                        {packet.direction === 'request' ? '请求 →' : '← 响应'}
                    </DirectionBadge>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>所在层</InfoLabel>
                    <InfoValue>{packet.layer}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>时间</InfoLabel>
                    <InfoValue>{formatTime(packet.timestamp)}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>ID</InfoLabel>
                    <InfoValue>{packet.id}</InfoValue>
                </InfoRow>
            </InfoGrid>

            {/* 地址信息 */}
            <Section>
                <SectionTitle>地址</SectionTitle>
                <InfoGrid>
                    <InfoRow>
                        <InfoLabel>源</InfoLabel>
                        <InfoValue>{packet.source}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>目标</InfoLabel>
                        <InfoValue>{packet.destination}</InfoValue>
                    </InfoRow>
                </InfoGrid>
            </Section>

            {/* IP 头部 */}
            {hasIpHeader && packet.ipHeader && (
                <Section>
                    <SectionTitle>IP 头部</SectionTitle>
                    <InfoGrid>
                        <InfoRow>
                            <InfoLabel>版本</InfoLabel>
                            <InfoValue>IPv{packet.ipHeader.version}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>源 IP</InfoLabel>
                            <InfoValue>{packet.ipHeader.sourceIp}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>目标 IP</InfoLabel>
                            <InfoValue>{packet.ipHeader.destinationIp}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>TTL</InfoLabel>
                            <InfoValue>{packet.ipHeader.ttl}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>协议</InfoLabel>
                            <InfoValue>{packet.ipHeader.protocol === 6 ? 'TCP (6)' : packet.ipHeader.protocol}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>总长度</InfoLabel>
                            <InfoValue>{packet.ipHeader.totalLength} bytes</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>头部长度</InfoLabel>
                            <InfoValue>{packet.ipHeader.headerLength * 4} bytes</InfoValue>
                        </InfoRow>
                    </InfoGrid>
                </Section>
            )}

            {/* TCP 头部 */}
            {hasTcpHeader && packet.tcpHeader && (
                <Section>
                    <SectionTitle>TCP 头部</SectionTitle>
                    <InfoGrid>
                        <InfoRow>
                            <InfoLabel>源端口</InfoLabel>
                            <InfoValue>{packet.tcpHeader.sourcePort}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>目的端口</InfoLabel>
                            <InfoValue>{packet.tcpHeader.destinationPort}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>序列号 (SEQ)</InfoLabel>
                            <InfoValue>{packet.tcpHeader.sequenceNumber}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>确认号 (ACK)</InfoLabel>
                            <InfoValue>{packet.tcpHeader.acknowledgmentNumber}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>头部长度</InfoLabel>
                            <InfoValue>{packet.tcpHeader.headerLength * 4} bytes</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>窗口大小</InfoLabel>
                            <InfoValue>{packet.tcpHeader.windowSize}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>校验和</InfoLabel>
                            <InfoValue>0x{packet.tcpHeader.checksum.toString(16).padStart(4, '0').toUpperCase()}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>紧急指针</InfoLabel>
                            <InfoValue>{packet.tcpHeader.urgentPointer}</InfoValue>
                        </InfoRow>
                    </InfoGrid>

                    <div style={{ marginTop: '6px' }}>
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

            {/* 以太网头部 */}
            {hasEthernet && packet.ethernetHeader && (
                <Section>
                    <SectionTitle>以太网帧</SectionTitle>
                    <InfoGrid>
                        <InfoRow>
                            <InfoLabel>源 MAC</InfoLabel>
                            <InfoValue>{packet.ethernetHeader.sourceMac}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>目标 MAC</InfoLabel>
                            <InfoValue>{packet.ethernetHeader.destinationMac}</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>以太类型</InfoLabel>
                            <InfoValue>0x{packet.ethernetHeader.etherType.toString(16).padStart(4, '0').toUpperCase()}</InfoValue>
                        </InfoRow>
                    </InfoGrid>
                </Section>
            )}

            {/* 载荷内容 */}
            <Section>
                <SectionTitle>载荷</SectionTitle>
                <PayloadBox>
                    <PayloadLabel>Payload</PayloadLabel>
                    {typeof packet.payload === 'string'
                        ? packet.payload
                        : JSON.stringify(packet.payload, null, 2)}
                </PayloadBox>
            </Section>
        </div>
    );
};

export default PacketDetailPanel;
