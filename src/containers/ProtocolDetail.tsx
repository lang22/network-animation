import React, { FC } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #eee;
`;

const Title = styled.h1`
  color: #333;
  margin: 0;
`;

const Description = styled.p`
  color: #666;
  font-size: 18px;
  margin: 10px 0 0 0;
`;

const Section = styled.section`
  margin: 25px 0;
`;

const SectionTitle = styled.h2`
  color: #2196F3;
  border-left: 4px solid #2196F3;
  padding-left: 15px;
  margin: 0 0 15px 0;
`;

const Content = styled.div`
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  line-height: 1.6;
`;

const ProtocolDetail: FC = () => {
  const { id } = useParams<{ id: string }>();

  // 根据协议ID显示不同的内容
  const getProtocolInfo = () => {
    switch(id) {
      case 'http':
        return {
          name: 'HTTP 协议',
          fullName: 'HyperText Transfer Protocol',
          description: '超文本传输协议，是互联网上应用最为广泛的一种网络协议。所有的WWW文件都必须遵守这个标准。',
          purpose: '用于在Web浏览器和Web服务器之间传输网页内容',
          features: [
            '基于请求-响应模型',
            '无状态协议',
            '支持多种方法（GET、POST、PUT、DELETE等）',
            '可扩展的头部字段'
          ],
          requestResponseCycle: [
            '客户端发送HTTP请求',
            '服务器接收并解析请求',
            '服务器处理请求并生成响应',
            '服务器发送HTTP响应',
            '客户端接收并处理响应'
          ]
        };
      case 'dns':
        return {
          name: 'DNS 协议',
          fullName: 'Domain Name System',
          description: '域名系统，用于将人类可读的域名转换为机器可读的IP地址。',
          purpose: '将域名映射到IP地址，方便用户访问网络资源',
          features: [
            '分布式数据库系统',
            '层次化的域名结构',
            '缓存机制提高查询效率',
            '支持多种记录类型（A、MX、CNAME等）'
          ],
          resolutionProcess: [
            '客户端向本地DNS服务器查询',
            '本地DNS服务器检查缓存',
            '如未命中缓存，则向上游服务器查询',
            '最终返回IP地址给客户端'
          ]
        };
      case 'dhcp':
        return {
          name: 'DHCP 协议',
          fullName: 'Dynamic Host Configuration Protocol',
          description: '动态主机配置协议，用于自动分配IP地址和其他网络配置参数给网络设备。',
          purpose: '自动化网络配置，简化网络管理',
          features: [
            '自动分配IP地址',
            '分配子网掩码、默认网关、DNS服务器等',
            'IP地址租约管理',
            '即插即用网络接入'
          ],
          leaseProcess: [
            '客户端发送DHCP Discover广播',
            '服务器回应DHCP Offer',
            '客户端请求特定IP地址（DHCP Request）',
            '服务器确认分配（DHCP Acknowledge）'
          ]
        };
      default:
        return {
          name: '未知协议',
          fullName: '',
          description: '未找到指定协议的详细信息。',
          purpose: '',
          features: [],
          requestResponseCycle: []
        };
    }
  };

  const protocolInfo = getProtocolInfo();

  return (
    <Container>
      <Header>
        <Title>{protocolInfo.name}</Title>
        {protocolInfo.fullName && <Description>{protocolInfo.fullName}</Description>}
      </Header>
      
      <Section>
        <SectionTitle>协议简介</SectionTitle>
        <Content>
          <p>{protocolInfo.description}</p>
          {protocolInfo.purpose && <p><strong>用途：</strong>{protocolInfo.purpose}</p>}
        </Content>
      </Section>
      
      {protocolInfo.features.length > 0 && (
        <Section>
          <SectionTitle>主要特点</SectionTitle>
          <Content>
            <ul>
              {protocolInfo.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </Content>
        </Section>
      )}
      
      {protocolInfo.requestResponseCycle && protocolInfo.requestResponseCycle.length > 0 && (
        <Section>
          <SectionTitle>工作流程</SectionTitle>
          <Content>
            <ol>
              {protocolInfo.requestResponseCycle.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </Content>
        </Section>
      )}
      
      <Section>
        <SectionTitle>模拟演示</SectionTitle>
        <Content>
          <p>此协议的动画模拟功能正在开发中...</p>
          <p>点击下方按钮返回首页选择TCP/IP协议进行演示：</p>
          <button 
            onClick={() => window.history.back()} 
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            返回首页
          </button>
        </Content>
      </Section>
    </Container>
  );
};

export default ProtocolDetail;