import React, { Component, ErrorInfo, ReactNode } from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f5f5f5;
`;

const ErrorTitle = styled.h1`
  color: #f44336;
  margin-bottom: 20px;
`;

const ErrorMessage = styled.p`
  color: #666;
  text-align: center;
  max-width: 600px;
  line-height: 1.6;
`;

const ErrorDetails = styled.pre`
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ddd;
  max-width: 800px;
  overflow-x: auto;
  font-size: 12px;
  color: #333;
`;

const RetryButton = styled.button`
  margin-top: 20px;
  padding: 12px 24px;
  background-color: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #1976d2;
  }
`;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorContainer>
          <ErrorTitle>出错了</ErrorTitle>
          <ErrorMessage>
            应用程序遇到了一个错误。请尝试刷新页面或点击下方按钮重试。
          </ErrorMessage>
          {error && (
            <ErrorDetails>
              <strong>错误信息:</strong>
              {'\n'}
              {error.toString()}
              {errorInfo && errorInfo.componentStack && (
                <>
                  {'\n\n'}
                  <strong>组件堆栈:</strong>
                  {'\n'}
                  {errorInfo.componentStack}
                </>
              )}
            </ErrorDetails>
          )}
          <RetryButton onClick={this.handleRetry}>重试</RetryButton>
        </ErrorContainer>
      );
    }

    return children;
  }
}

export default ErrorBoundary;