import { DNS_NODES, buildDnsLookup } from '../dnsService';

describe('dnsService', () => {
  it('builds the recursive lookup from client to answer', () => {
    const { steps, answer } = buildDnsLookup('example.com', 'A');

    expect(steps).toHaveLength(8);
    expect(steps[0].from).toBe('client');
    expect(steps[0].to).toBe('resolver');
    expect(steps[steps.length - 1].to).toBe('client');
    expect(answer.domain).toBe('example.com');
    expect(answer.type).toBe('A');
    expect(answer.value).toBe('93.184.216.34');
    expect(answer.ttl).toBe(3600);
  });

  it('returns AAAA answers when asked', () => {
    const { answer } = buildDnsLookup('example.com', 'AAAA');

    expect(answer.value).toContain(':');
    expect(answer.type).toBe('AAAA');
  });

  it('only references nodes that exist on the canvas', () => {
    const ids = new Set(DNS_NODES.map(node => node.id));

    for (const step of buildDnsLookup('example.com').steps) {
      expect(ids.has(step.from)).toBe(true);
      expect(ids.has(step.to)).toBe(true);
    }
  });

  it('mentions the queried domain in the first step', () => {
    const { steps } = buildDnsLookup('api.example.org');

    expect(steps[0].label).toContain('api.example.org');
  });
});
