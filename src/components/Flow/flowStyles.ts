import styled from 'styled-components';
import { darkTheme } from '@/styles/theme';

// DNS / DHCP 页面共用的样式骨架，保持和拥塞控制、HTTP 页面一致的外观

export const Page = styled.div`
  width: 100vw; height: 100vh;
  display: grid; grid-template-rows: 48px 1fr;
  background: ${darkTheme.colors.background}; overflow: hidden;
`;
export const Main = styled.div`
  display: grid; grid-template-columns: 220px 1fr 320px;
  gap: 16px; padding: 16px; height: 100%; box-sizing: border-box;
  min-height: 0; overflow: hidden;
`;
export const Panel = styled.div`
  background: ${darkTheme.colors.surface}; border-radius: 12px;
  border: 1px solid ${darkTheme.colors.border};
  display: flex; flex-direction: column; overflow: hidden; min-height: 0;
`;
export const PanelH = styled.div`
  padding: 14px 16px; border-bottom: 1px solid ${darkTheme.colors.border};
  font-size: 13px; font-weight: 600; color: ${darkTheme.colors.text};
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
`;
export const PanelC = styled.div`
  padding: 14px; display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto; flex: 1; min-height: 0;
`;
export const Btn = styled.button<{ $v?: 'primary' | 'accent' }>`
  width: 100%; padding: 11px 14px; border-radius: 8px;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none;
  ${({ $v }) => $v === 'accent' ? `
    background: linear-gradient(90deg, ${darkTheme.colors.primary}, ${darkTheme.colors.secondaryLight});
    color: #fff; box-shadow: 0 0 12px ${darkTheme.colors.glow};
  ` : `
    background: ${darkTheme.colors.surfaceLight}; color: ${darkTheme.colors.text};
    border: 1px solid ${darkTheme.colors.border};
  `}
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.85; }
`;
export const FieldLabel = styled.div` font-size: 10px; color: ${darkTheme.colors.textMuted}; `;
export const Input = styled.input`
  width: 100%; box-sizing: border-box; padding: 8px 10px;
  border-radius: 6px; border: 1px solid ${darkTheme.colors.border};
  background: rgba(0,0,0,0.25); color: ${darkTheme.colors.text};
  font-size: 11px; font-family: 'JetBrains Mono', monospace;
`;
export const Row = styled.div` display: flex; gap: 6px; `;
export const ChoiceBtn = styled.button<{ $a?: boolean }>`
  flex: 1; padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid ${({ $a }) => $a ? darkTheme.colors.primary : darkTheme.colors.border};
  background: ${({ $a }) => $a ? darkTheme.colors.primary : 'transparent'};
  color: ${({ $a }) => $a ? '#000' : darkTheme.colors.textMuted};
  font-size: 11px; font-weight: 600;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
export const StatusBox = styled.div<{ $tone: 'idle' | 'active' | 'done' }>`
  padding: 10px; border-radius: 0 6px 6px 0; font-size: 11px; line-height: 1.6;
  border-left: 3px solid ${({ $tone }) =>
    $tone === 'done' ? darkTheme.colors.success :
    $tone === 'active' ? darkTheme.colors.primary : darkTheme.colors.border};
  background: rgba(0,212,255,0.08);
  color: ${darkTheme.colors.text};
`;
export const SectionTitle = styled.div`
  font-size: 11px; font-weight: 600; color: ${darkTheme.colors.textMuted};
  margin-top: 4px;
`;
export const ResultRow = styled.div`
  display: flex; justify-content: space-between; gap: 10px;
  padding: 6px 0; font-size: 11px; color: ${darkTheme.colors.text};
  border-bottom: 1px solid ${darkTheme.colors.border};
  span {
    color: ${darkTheme.colors.primary}; font-weight: 600;
    font-family: 'JetBrains Mono', monospace; text-align: right;
    word-break: break-all;
  }
`;
export const LogLine = styled.div`
  font-family: 'JetBrains Mono', monospace; font-size: 10px; line-height: 1.8;
  color: ${darkTheme.colors.textMuted};
`;
export const Placeholder = styled.div`
  font-size: 11px; color: ${darkTheme.colors.textMuted}; padding: 8px 0;
`;
