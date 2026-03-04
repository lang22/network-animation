import React from 'react';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';

const StackContainer = styled.div`
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    overflow: hidden;
`;

const StackHeader = styled.div`
    padding: 12px 16px;
    background: ${darkTheme.colors.surfaceLight};
    border-bottom: 1px solid ${darkTheme.colors.border};
`;

const StackTitle = styled.h4`
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
    display: flex;
    align-items: center;
    gap: 8px;
`;

const StackContent = styled.div`
    padding: 12px;
`;

const LayerItem = styled.div<{ $active?: boolean }>`
    padding: 10px 12px;
    margin-bottom: 6px;
    border-radius: 8px;
    background: ${({ $active }) =>
        $active ? `linear-gradient(90deg, rgba(0, 212, 255, 0.1), transparent)` : darkTheme.colors.surfaceLight};
    border-left: 3px solid ${({ $active }) =>
        $active ? darkTheme.colors.primary : darkTheme.colors.border};
    transition: all 0.3s ease;
    cursor: default;

    &:last-child {
        margin-bottom: 0;
    }

    ${({ $active }) => $active && `
        box-shadow: 0 0 15px rgba(0, 212, 255, 0.1);
    `}
`;

const LayerName = styled.div<{ $active?: boolean }>`
    font-size: 12px;
    font-weight: 600;
    color: ${({ $active }) =>
        $active ? darkTheme.colors.primary : darkTheme.colors.text};
    margin-bottom: 2px;
`;

const LayerDescription = styled.div`
    font-size: 10px;
    color: ${darkTheme.colors.textMuted};
`;

const LayerIcon = styled.span`
    margin-right: 8px;
`;

const layers = [
    { id: 'application', name: '应用层', description: 'HTTP/FTP/SMTP', icon: '🌐' },
    { id: 'transport', name: '传输层', description: 'TCP/UDP', icon: '📦' },
    { id: 'network', name: '网络层', description: 'IP/ICMP', icon: '🔗' },
    { id: 'link', name: '链路层', description: 'Ethernet/WiFi', icon: '🔌' },
];

interface ProtocolStackPanelProps {
    activeLayers: string[];
}

const ProtocolStackPanel: React.FC<ProtocolStackPanelProps> = ({ activeLayers }) => {
    return (
        <StackContainer>
            <StackHeader>
                <StackTitle>📚 协议栈</StackTitle>
            </StackHeader>
            <StackContent>
                {layers.map(layer => (
                    <LayerItem
                        key={layer.id}
                        $active={activeLayers.includes(layer.id)}
                    >
                        <LayerName $active={activeLayers.includes(layer.id)}>
                            <LayerIcon>{layer.icon}</LayerIcon>
                            {layer.name}
                        </LayerName>
                        <LayerDescription>{layer.description}</LayerDescription>
                    </LayerItem>
                ))}
            </StackContent>
        </StackContainer>
    );
};

export default ProtocolStackPanel;