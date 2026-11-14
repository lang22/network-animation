import {
  DHCP_LEASE, DHCP_NODES, DHCP_STATES, buildDhcpExchange, buildDhcpRelease,
  buildDhcpRenew, dhcpStateAt,
} from '../dhcpService';

describe('dhcpService', () => {
  it('builds the DORA exchange in order', () => {
    const steps = buildDhcpExchange();

    expect(steps.map(step => step.id)).toEqual(['discover', 'offer', 'request', 'ack']);
    expect(steps[0].from).toBe('client');
    expect(steps[1].from).toBe('server');
    expect(steps[3].label).toBe('DHCP ACK');
  });

  it('carries the lease details in the offer and ack', () => {
    const steps = buildDhcpExchange();

    expect(steps[1].detail).toContain(DHCP_LEASE.ip);
    expect(steps[3].detail).toContain(DHCP_LEASE.gateway);
    expect(steps[3].detail).toContain(DHCP_LEASE.dns);
  });

  it('maps step index to the DHCP state machine', () => {
    expect(dhcpStateAt(-1)).toBe('INIT');
    expect(dhcpStateAt(0)).toBe('INIT');
    expect(dhcpStateAt(1)).toBe('SELECTING');
    expect(dhcpStateAt(2)).toBe('REQUESTING');
    expect(dhcpStateAt(3)).toBe('BOUND');
    expect(DHCP_STATES).toHaveLength(4);
  });

  it('only references nodes that exist on the canvas', () => {
    const ids = new Set(DHCP_NODES.map(node => node.id));

    for (const step of buildDhcpExchange()) {
      expect(ids.has(step.from)).toBe(true);
      expect(ids.has(step.to)).toBe(true);
    }
  });

  it('builds a two-step renew after half of the lease', () => {
    const steps = buildDhcpRenew();

    expect(steps).toHaveLength(2);
    expect(steps[0].from).toBe('client');
    expect(steps[0].label).toContain('续租');
    expect(steps[0].detail).toContain('T1');
    expect(steps[1].from).toBe('server');
  });

  it('builds a single release message', () => {
    const steps = buildDhcpRelease();

    expect(steps).toHaveLength(1);
    expect(steps[0].from).toBe('client');
    expect(steps[0].to).toBe('server');
    expect(steps[0].detail).toContain(DHCP_LEASE.ip);
  });
});
