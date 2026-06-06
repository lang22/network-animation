import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { darkTheme } from '@/styles/theme';

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 48px;
  background: ${darkTheme.colors.surface};
  border-bottom: 1px solid ${darkTheme.colors.border};
  flex-shrink: 0;
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: 1px solid ${darkTheme.colors.border};
  border-radius: 6px;
  color: ${darkTheme.colors.textMuted};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: ${darkTheme.colors.text};
    border-color: ${darkTheme.colors.primary};
    background: rgba(0, 212, 255, 0.05);
  }
`;

const Title = styled.h1`
  font-size: 15px;
  font-weight: 600;
  color: ${darkTheme.colors.text};
  margin: 0 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;

  &::before {
    content: '';
    width: 4px;
    height: 16px;
    background: ${darkTheme.colors.primary};
    border-radius: 2px;
  }
`;

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title = 'TCP 协议模拟器' }) => {
  const navigate = useNavigate();

  return (
    <HeaderContainer>
      <BackButton onClick={() => navigate('/')}>
        ← 返回
      </BackButton>
      <Title>{title}</Title>
    </HeaderContainer>
  );
};

export default Header;