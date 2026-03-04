import React, { FC } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';

const Container = styled.div`
    min-height: 100vh;
    background: linear-gradient(135deg, ${darkTheme.colors.background} 0%, ${darkTheme.colors.surface} 100%);
    padding: 40px 20px;
`;

const Content = styled.div`
    max-width: 1000px;
    margin: 0 auto;
`;

const Title = styled.h1`
    text-align: center;
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 8px 0;
    background: linear-gradient(90deg, ${darkTheme.colors.text} 0%, ${darkTheme.colors.primary} 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
`;

const Subtitle = styled.p`
    text-align: center;
    font-size: 16px;
    color: ${darkTheme.colors.textMuted};
    margin: 0 0 40px 0;
`;

const SectionTitle = styled.h2`
    font-size: 18px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid ${darkTheme.colors.primary};
    display: inline-block;
`;

const ProtocolGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
`;

const ProtocolCard = styled(Link)`
    display: block;
    padding: 24px;
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
    text-decoration: none;
    color: inherit;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondary});
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    &:hover {
        transform: translateY(-4px);
        border-color: ${darkTheme.colors.primary};
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 212, 255, 0.1);

        &::before {
            opacity: 1;
        }
    }
`;

const CardIcon = styled.div`
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, ${darkTheme.colors.primary} 0%, ${darkTheme.colors.secondary} 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-bottom: 16px;
`;

const CardTitle = styled.h3`
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
    color: ${darkTheme.colors.text};
`;

const CardDescription = styled.p`
    margin: 0;
    font-size: 14px;
    color: ${darkTheme.colors.textMuted};
    line-height: 1.6;
`;

const CardBadge = styled.span<{ $available?: boolean }>`
    display: inline-block;
    margin-top: 12px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    background: ${({ $available }) =>
        $available ? 'rgba(34, 197, 94, 0.15)' : 'rgba(249, 115, 22, 0.15)'};
    color: ${({ $available }) =>
        $available ? darkTheme.colors.success : darkTheme.colors.accent};
    border: 1px solid ${({ $available }) =>
        $available ? darkTheme.colors.success : darkTheme.colors.accent};
`;

const FeatureSection = styled.div`
    margin-top: 40px;
    padding: 24px;
    background: ${darkTheme.colors.surface};
    border-radius: 12px;
    border: 1px solid ${darkTheme.colors.border};
`;

const FeatureList = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 16px;
`;

const FeatureItem = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: ${darkTheme.colors.surfaceLight};
    border-radius: 8px;
`;

const FeatureIcon = styled.span`
    font-size: 20px;
`;

const FeatureText = styled.span`
    font-size: 14px;
    color: ${darkTheme.colors.text};
`;

const protocols = [
    {
        id: 'tcp',
        name: 'TCP/IP 协议',
        description: '传输控制协议/互联网协议，提供可靠的、面向连接的数据传输服务',
        icon: '🔌',
        available: true,
        path: '/simulation'
    },
    {
        id: 'http',
        name: 'HTTP 协议',
        description: '超文本传输协议，用于在 Web 浏览器和服务器之间传输网页内容',
        icon: '🌐',
        available: false,
        path: '/protocol/http'
    },
    {
        id: 'dns',
        name: 'DNS 协议',
        description: '域名系统协议，将人类可读的域名转换为机器可读的 IP 地址',
        icon: '📡',
        available: false,
        path: '/protocol/dns'
    },
    {
        id: 'dhcp',
        name: 'DHCP 协议',
        description: '动态主机配置协议，自动分配 IP 地址给网络设备',
        icon: '⚙️',
        available: false,
        path: '/protocol/dhcp'
    }
];

const features = [
    { icon: '🎬', text: '动画演示协议流程' },
    { icon: '📦', text: '数据包详情查看' },
    { icon: '⏱️', text: '时间线步骤指示' },
    { icon: '📚', text: '协议栈可视化' },
];

const Home: FC = () => {
    return (
        <Container>
            <Content>
                <Title>Network Protocol Simulator</Title>
                <Subtitle>交互式网络协议动画模拟器，帮助你理解协议工作原理</Subtitle>

                <SectionTitle>可用协议</SectionTitle>
                <ProtocolGrid>
                    {protocols.map(protocol => (
                        <ProtocolCard key={protocol.id} to={protocol.path}>
                            <CardIcon>{protocol.icon}</CardIcon>
                            <CardTitle>{protocol.name}</CardTitle>
                            <CardDescription>{protocol.description}</CardDescription>
                            <CardBadge $available={protocol.available}>
                                {protocol.available ? '✅ 可用' : '🚧 开发中'}
                            </CardBadge>
                        </ProtocolCard>
                    ))}
                </ProtocolGrid>

                <FeatureSection>
                    <SectionTitle>功能特性</SectionTitle>
                    <FeatureList>
                        {features.map((feature, index) => (
                            <FeatureItem key={index}>
                                <FeatureIcon>{feature.icon}</FeatureIcon>
                                <FeatureText>{feature.text}</FeatureText>
                            </FeatureItem>
                        ))}
                    </FeatureList>
                </FeatureSection>
            </Content>
        </Container>
    );
};

export default Home;