// Jest setup file
import '@testing-library/jest-dom';

// jsdom 没有实现 ResizeObserver 与 scrollIntoView，组件测试里补桩
class ResizeObserverStub {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}

(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = jest.fn();
