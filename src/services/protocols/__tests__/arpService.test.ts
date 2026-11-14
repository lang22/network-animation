import { ARP_NODES, BROADCAST_MAC, buildArpExchange } from '../arpService';

describe('arpService', () => {
  it('broadcasts the request to every other host', () => {
    const { steps } = buildArpExchange('b');

    expect(steps).toHaveLength(3);
    expect(steps[0].to).toEqual(['b', 'c']);
    expect(steps[0].detail).toContain(BROADCAST_MAC);
  });

  it('replies from the target host with its MAC', () => {
    const { steps, result } = buildArpExchange('c');

    expect(steps[1].from).toBe('c');
    expect(steps[1].to).toBe('a');
    expect(result.targetIp).toBe('192.168.1.30');
    expect(result.targetMac).toBe('aa:bb:cc:00:00:03');
    expect(result.ttlSeconds).toBe(60);
  });

  it('sends the data frame to the resolved MAC', () => {
    const { steps } = buildArpExchange('b');

    expect(steps[2].label).toContain('aa:bb:cc:00:00:02');
    expect(steps[2].detail).toContain('ARP 缓存');
  });

  it('only references nodes that exist on the canvas', () => {
    const ids = new Set(ARP_NODES.map(node => node.id));

    for (const step of buildArpExchange('b').steps) {
      expect(ids.has(step.from)).toBe(true);
      const targets = Array.isArray(step.to) ? step.to : [step.to];
      targets.forEach(target => expect(ids.has(target)).toBe(true));
    }
  });
});
