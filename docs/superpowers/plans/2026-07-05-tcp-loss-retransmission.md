# TCP Loss Retransmission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a teaching-focused packet loss, RTO timeout, and retransmission flow to the TCP congestion control visualizer.

**Architecture:** Extend the existing congestion control module rather than the TCP handshake visualizer. Keep congestion math in `congestionService.ts`, state transitions in `congestionSlice.ts`, animation orchestration in `useCongestionControl.ts`, and visual rendering in the existing `CongestionControl` components.

**Tech Stack:** React 18, TypeScript, Redux Toolkit, styled-components, Jest.

## Global Constraints

- Do not add new runtime dependencies.
- Do not restructure unrelated TCP handshake, data transfer, or close animation code.
- Do not create git commits unless the user explicitly requests them.
- Keep the first implementation focused on RTO timeout retransmission; fast retransmit is a later extension.
- Preserve the existing random packet loss toggle, but add deterministic "drop next packet" support for demos and tests.
- Use ASCII for new code and docs unless editing existing non-ASCII user-facing copy.

---

## File Structure

- Modify `src/types/congestionTypes.ts`: Add packet lifecycle, RTO, loss mode, and retransmission queue types.
- Modify `src/services/protocols/congestionService.ts`: Add pure functions for timeout loss, retry decisions, and deterministic drop decisions.
- Create `src/services/protocols/__tests__/congestionService.test.ts`: Cover congestion math and drop decisions.
- Modify `src/store/slices/congestionSlice.ts`: Store in-flight packets, retransmission queue, RTO settings, loss rate, and deterministic drop sequence.
- Create `src/store/slices/__tests__/congestionSlice.test.ts`: Cover reducer-level packet lifecycle transitions.
- Modify `src/hooks/useCongestionControl.ts`: Replace immediate-loss handling with lost -> timeout -> retransmit orchestration.
- Modify `src/components/CongestionControl/FlyingBall.tsx`: Render lost and retransmitted packets distinctly.
- Modify `src/components/CongestionControl/CongestionVisualizer.tsx`: Add loss controls and RTO/retransmission counters.
- Optionally modify `PROJECT_STATUS.md`: Add a short note after implementation if the user wants docs updated.

---

### Task 1: Model RTO State

**Files:**
- Modify: `src/types/congestionTypes.ts`

**Interfaces:**
- Produces: `PacketLifecycleStatus`, `InFlightPacket`, `RetransmissionItem`, `LossDecisionConfig`, `RtoConfig`
- Consumed by: `congestionSlice.ts`, `congestionService.ts`, `useCongestionControl.ts`

- [ ] **Step 1: Add packet lifecycle types**

Add these definitions after `FlightBall`:

```ts
export type PacketLifecycleStatus =
  | 'created'
  | 'flying'
  | 'lost'
  | 'waiting_timeout'
  | 'retransmitting'
  | 'acked';

export interface InFlightPacket {
  seqNum: number;
  ballId: string;
  sentAt: number;
  rtoAt: number;
  attempt: number;
  status: PacketLifecycleStatus;
}

export interface RetransmissionItem {
  seqNum: number;
  attempt: number;
  originalBallId: string;
}
```

- [ ] **Step 2: Add RTO and drop configuration types**

Add these definitions near the congestion state types:

```ts
export interface RtoConfig {
  baseMs: number;
  maxRetransmissions: number;
}

export interface LossDecisionConfig {
  enabled: boolean;
  lossRate: number;
  dropNextSeq: number | null;
}
```

- [ ] **Step 3: Extend `LogEntry` type**

Change:

```ts
type: 'info' | 'success' | 'error' | 'rtt';
```

to:

```ts
type: 'info' | 'success' | 'error' | 'rtt' | 'timeout' | 'retransmit';
```

- [ ] **Step 4: Extend `CongestionState`**

Add:

```ts
inFlightPackets: InFlightPacket[];
retransmissionQueue: RetransmissionItem[];
rtoConfig: RtoConfig;
lossRate: number;
dropNextSeq: number | null;
timeoutCount: number;
retransmissionCount: number;
```

- [ ] **Step 5: Run type check**

Run: `npm run build`

Expected: TypeScript errors in reducers and hook code because the new required state fields are not initialized yet.

---

### Task 2: Add Pure Congestion Service Logic

**Files:**
- Modify: `src/services/protocols/congestionService.ts`
- Create: `src/services/protocols/__tests__/congestionService.test.ts`

**Interfaces:**
- Consumes: `SenderWindowState`, `CongestionPhase`, `LossDecisionConfig`
- Produces: `handleTimeoutLoss(window)`, `shouldDropPacket(config, seqNum, randomValue?)`, `canRetransmit(attempt, maxRetransmissions)`

- [ ] **Step 1: Write failing service tests**

Create `src/services/protocols/__tests__/congestionService.test.ts`:

```ts
import {
  handleTimeoutLoss,
  shouldDropPacket,
  canRetransmit,
} from '../congestionService';
import { CongestionPhase, SenderWindowState } from '@/types/congestionTypes';

const makeWindow = (cwnd: number): SenderWindowState => ({
  cwnd,
  ssthresh: 64,
  lastAcked: 0,
  nextSeq: 1,
  allowedToSend: cwnd,
});

describe('congestionService retransmission helpers', () => {
  it('collapses cwnd to 1 and halves ssthresh on timeout loss', () => {
    const result = handleTimeoutLoss(makeWindow(12));

    expect(result.window.cwnd).toBe(1);
    expect(result.window.ssthresh).toBe(6);
    expect(result.window.allowedToSend).toBe(1);
    expect(result.phase).toBe(CongestionPhase.SLOW_START);
  });

  it('keeps ssthresh at least 2 on timeout loss', () => {
    const result = handleTimeoutLoss(makeWindow(3));

    expect(result.window.ssthresh).toBe(2);
    expect(result.window.cwnd).toBe(1);
  });

  it('drops the configured deterministic packet before random loss', () => {
    expect(shouldDropPacket({
      enabled: true,
      lossRate: 0,
      dropNextSeq: 7,
    }, 7, 0.99)).toBe(true);
  });

  it('uses loss rate when deterministic sequence does not match', () => {
    expect(shouldDropPacket({
      enabled: true,
      lossRate: 0.1,
      dropNextSeq: 7,
    }, 8, 0.05)).toBe(true);
  });

  it('does not drop packets when loss is disabled', () => {
    expect(shouldDropPacket({
      enabled: false,
      lossRate: 1,
      dropNextSeq: 1,
    }, 1, 0)).toBe(false);
  });

  it('allows attempts below max retransmissions', () => {
    expect(canRetransmit(2, 3)).toBe(true);
    expect(canRetransmit(3, 3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- congestionService.test.ts`

Expected: FAIL because `handleTimeoutLoss` and `canRetransmit` are not exported, and `shouldDropPacket` still has the old signature.

- [ ] **Step 3: Implement service helpers**

In `congestionService.ts`, import `LossDecisionConfig` and replace the old loss helper with:

```ts
export function handleTimeoutLoss(window: SenderWindowState): {
  window: SenderWindowState;
  phase: CongestionPhase;
} {
  const newSsthresh = Math.max(Math.floor(window.cwnd / 2), 2);

  return {
    window: {
      ...window,
      cwnd: INITIAL_CWND,
      ssthresh: newSsthresh,
      allowedToSend: INITIAL_CWND,
    },
    phase: CongestionPhase.SLOW_START,
  };
}

export function canRetransmit(attempt: number, maxRetransmissions: number): boolean {
  return attempt < maxRetransmissions;
}

export function shouldDropPacket(
  config: LossDecisionConfig,
  seqNum: number,
  randomValue: number = Math.random()
): boolean {
  if (!config.enabled) return false;
  if (config.dropNextSeq === seqNum) return true;
  return randomValue < config.lossRate;
}
```

Keep `handlePacketLoss` for compatibility during the transition, but the hook should stop using it after Task 5.

- [ ] **Step 4: Run service tests**

Run: `npm test -- congestionService.test.ts`

Expected: PASS.

---

### Task 3: Add Redux Packet Lifecycle State

**Files:**
- Modify: `src/store/slices/congestionSlice.ts`
- Create: `src/store/slices/__tests__/congestionSlice.test.ts`

**Interfaces:**
- Consumes: `InFlightPacket`, `RetransmissionItem`
- Produces actions: `trackPacketSent`, `markPacketLost`, `markPacketWaitingTimeout`, `markPacketAcked`, `enqueueRetransmission`, `dequeueRetransmission`, `setLossRate`, `setDropNextSeq`, `incrementTimeout`, `incrementRetransmission`

- [ ] **Step 1: Write failing reducer tests**

Create `src/store/slices/__tests__/congestionSlice.test.ts`:

```ts
import congestionReducer, {
  trackPacketSent,
  markPacketLost,
  markPacketWaitingTimeout,
  markPacketAcked,
  enqueueRetransmission,
  dequeueRetransmission,
  setLossRate,
  setDropNextSeq,
  incrementTimeout,
  incrementRetransmission,
  reset,
} from '../congestionSlice';

describe('congestionSlice retransmission state', () => {
  it('tracks packet lifecycle from sent to timeout to acked', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, trackPacketSent({
      seqNum: 4,
      ballId: 'ball_4',
      sentAt: 1000,
      rtoAt: 5000,
      attempt: 1,
      status: 'flying',
    }));
    state = congestionReducer(state, markPacketLost(4));
    state = congestionReducer(state, markPacketWaitingTimeout(4));
    state = congestionReducer(state, markPacketAcked(4));

    expect(state.inFlightPackets).toHaveLength(0);
    expect(state.ackedPackets).toBe(1);
  });

  it('queues and dequeues retransmission items', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, enqueueRetransmission({
      seqNum: 5,
      attempt: 2,
      originalBallId: 'ball_5',
    }));
    state = congestionReducer(state, dequeueRetransmission(5));

    expect(state.retransmissionQueue).toEqual([]);
  });

  it('stores loss controls and counters', () => {
    let state = congestionReducer(undefined, reset());

    state = congestionReducer(state, setLossRate(0.2));
    state = congestionReducer(state, setDropNextSeq(9));
    state = congestionReducer(state, incrementTimeout());
    state = congestionReducer(state, incrementRetransmission());

    expect(state.lossRate).toBe(0.2);
    expect(state.dropNextSeq).toBe(9);
    expect(state.timeoutCount).toBe(1);
    expect(state.retransmissionCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run failing reducer test**

Run: `npm test -- congestionSlice.test.ts`

Expected: FAIL because the new actions and state fields do not exist.

- [ ] **Step 3: Initialize new state fields**

In `initialState`, add:

```ts
inFlightPackets: [],
retransmissionQueue: [],
rtoConfig: {
  baseMs: 4200,
  maxRetransmissions: 3,
},
lossRate: 0.05,
dropNextSeq: null,
timeoutCount: 0,
retransmissionCount: 0,
```

- [ ] **Step 4: Add reducers**

Add these reducers:

```ts
trackPacketSent: (state, action: PayloadAction<InFlightPacket>) => {
  state.inFlightPackets = state.inFlightPackets.filter(p => p.seqNum !== action.payload.seqNum);
  state.inFlightPackets.push(action.payload);
},
markPacketLost: (state, action: PayloadAction<number>) => {
  const packet = state.inFlightPackets.find(p => p.seqNum === action.payload);
  if (packet) packet.status = 'lost';
},
markPacketWaitingTimeout: (state, action: PayloadAction<number>) => {
  const packet = state.inFlightPackets.find(p => p.seqNum === action.payload);
  if (packet) packet.status = 'waiting_timeout';
},
markPacketAcked: (state, action: PayloadAction<number>) => {
  state.inFlightPackets = state.inFlightPackets.filter(p => p.seqNum !== action.payload);
  state.ackedPackets += 1;
},
enqueueRetransmission: (state, action: PayloadAction<RetransmissionItem>) => {
  state.retransmissionQueue = state.retransmissionQueue.filter(item => item.seqNum !== action.payload.seqNum);
  state.retransmissionQueue.push(action.payload);
},
dequeueRetransmission: (state, action: PayloadAction<number>) => {
  state.retransmissionQueue = state.retransmissionQueue.filter(item => item.seqNum !== action.payload);
},
setLossRate: (state, action: PayloadAction<number>) => {
  state.lossRate = Math.max(0, Math.min(1, action.payload));
},
setDropNextSeq: (state, action: PayloadAction<number | null>) => {
  state.dropNextSeq = action.payload;
},
incrementTimeout: (state) => {
  state.timeoutCount += 1;
},
incrementRetransmission: (state) => {
  state.retransmissionCount += 1;
},
```

Add `InFlightPacket` and `RetransmissionItem` to the imports, and export the new actions.

- [ ] **Step 5: Run reducer tests**

Run: `npm test -- congestionSlice.test.ts`

Expected: PASS.

---

### Task 4: Adapt Flight Ball Rendering

**Files:**
- Modify: `src/components/CongestionControl/FlyingBall.tsx`

**Interfaces:**
- Consumes: existing `FlightBall` plus `isLost` and new `attempt` field if added to `FlightBall`
- Produces: clear visual distinction for lost and retransmitted packets

- [ ] **Step 1: Add retransmission metadata to `FlightBall`**

In `src/types/congestionTypes.ts`, add optional fields to `FlightBall`:

```ts
attempt?: number;
isRetransmission?: boolean;
```

- [ ] **Step 2: Update visual styles**

In `FlyingBall.tsx`, use these rules:

```ts
const color = ball.isLost
  ? darkTheme.colors.error
  : ball.isAck
    ? darkTheme.colors.success
    : ball.isRetransmission
      ? darkTheme.colors.warning
      : darkTheme.colors.primary;
```

Render label text:

```ts
const label = ball.isAck
  ? `ACK ${ball.seqNum}`
  : ball.isRetransmission
    ? `RTX ${ball.seqNum}`
    : `${ball.seqNum}`;
```

- [ ] **Step 3: Build to verify rendering types**

Run: `npm run build`

Expected: PASS once Task 5 hook changes are also complete. If run before Task 5, unresolved type errors from hook code are acceptable.

---

### Task 5: Orchestrate Timeout and Retransmission

**Files:**
- Modify: `src/hooks/useCongestionControl.ts`

**Interfaces:**
- Consumes: `handleTimeoutLoss`, `canRetransmit`, new Redux actions
- Produces: lost packet waits for RTO, enqueues retransmission, retransmits, then ACKs or stops after max attempts

- [ ] **Step 1: Replace old imports**

Remove `handlePacketLoss` from imports and add:

```ts
handleTimeoutLoss,
canRetransmit,
```

From `congestionSlice`, import:

```ts
trackPacketSent,
markPacketLost,
markPacketWaitingTimeout,
markPacketAcked,
enqueueRetransmission,
dequeueRetransmission,
setLossRate,
setDropNextSeq,
incrementTimeout,
incrementRetransmission,
```

- [ ] **Step 2: Track timeout handles**

Add near the existing refs:

```ts
const timeoutRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
```

Clear it in `performFullDemo`, `performSlowStart`, `resetAll`, and unmount cleanup:

```ts
timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
timeoutRefs.current.clear();
```

- [ ] **Step 3: Track packet sends**

When creating a normal data `FlightBall`, set:

```ts
const now = performance.now();
const attempt = 1;
```

Use `now` for `startTime`, and after `dispatch(addFlightBall(ball))`, dispatch:

```ts
dispatch(trackPacketSent({
  seqNum: seq,
  ballId: ball.id,
  sentAt: now,
  rtoAt: now + getDur(stateRef.current.rtoConfig.baseMs),
  attempt,
  status: 'flying',
}));
```

- [ ] **Step 4: Replace immediate loss with RTO wait**

Inside the arrival callback, replace the current `handlePacketLoss` block with:

```ts
const lossConfig = {
  enabled: cur.packetLossEnabled,
  lossRate: cur.lossRate,
  dropNextSeq: cur.dropNextSeq,
};

if (shouldDropPacket(lossConfig, seq)) {
  dispatch(incrementLost());
  dispatch(markBallLost(ball.id));
  dispatch(markPacketLost(seq));
  dispatch(markPacketWaitingTimeout(seq));
  dispatch(setDropNextSeq(null));
  dispatch(setAnimationStatus(`Packet #${seq} lost; waiting for RTO`));
  dispatch(addLogEntry({ text: `Packet #${seq} lost; waiting for RTO`, type: 'error' }));

  const timeoutId = setTimeout(() => {
    const latest = stateRef.current;
    const tracked = latest.inFlightPackets.find(packet => packet.seqNum === seq);
    if (!tracked || tracked.status === 'acked') return;

    dispatch(incrementTimeout());
    const result = handleTimeoutLoss(latest.window);
    dispatch(setWindow(result.window));
    dispatch(setPhase(result.phase));
    dispatch(setAnimationStatus(`RTO expired for #${seq}; cwnd reset to 1`));
    dispatch(addLogEntry({ text: `RTO expired for #${seq}; retransmitting`, type: 'timeout' }));

    if (canRetransmit(tracked.attempt, latest.rtoConfig.maxRetransmissions)) {
      dispatch(enqueueRetransmission({
        seqNum: seq,
        attempt: tracked.attempt + 1,
        originalBallId: tracked.ballId,
      }));
      void retransmitPacket(seq, tracked.attempt + 1, trackY);
    } else {
      dispatch(addLogEntry({ text: `Packet #${seq} reached retry limit`, type: 'error' }));
    }
  }, getDur(cur.rtoConfig.baseMs));

  timeoutRefs.current.set(seq, timeoutId);
  completedCount++;
  checkDone();
  return;
}
```

- [ ] **Step 5: Add `retransmitPacket` helper**

Define this helper before `sendBatch`:

```ts
const retransmitPacket = useCallback((seq: number, attempt: number, trackY: number): Promise<void> => {
  return new Promise((resolve) => {
    if (!isMountedRef.current) { resolve(); return; }

    const id = `rtx_${seq}_${Date.now()}`;
    const now = performance.now();
    const ball: FlightBall = {
      id,
      progress: 0,
      trackY,
      isAck: false,
      isLost: false,
      isRetransmission: true,
      seqNum: seq,
      attempt,
      startTime: now,
      duration: getDur(FLIGHT_MS),
    };

    dispatch(incrementRetransmission());
    dispatch(dequeueRetransmission(seq));
    dispatch(addFlightBall(ball));
    dispatch(trackPacketSent({
      seqNum: seq,
      ballId: id,
      sentAt: now,
      rtoAt: now + getDur(stateRef.current.rtoConfig.baseMs),
      attempt,
      status: 'retransmitting',
    }));
    dispatch(addLogEntry({ text: `Retransmit packet #${seq} (attempt ${attempt})`, type: 'retransmit' }));

    registerBall(id, now, getDur(FLIGHT_MS), () => {
      const ackId = `ack_rtx_${seq}_${Date.now()}`;
      const ackBall: FlightBall = {
        id: ackId,
        progress: 0,
        trackY,
        isAck: true,
        isLost: false,
        seqNum: seq,
        startTime: performance.now(),
        duration: getDur(ACK_MS),
      };

      dispatch(addFlightBall(ackBall));
      setTimeout(() => { if (isMountedRef.current) dispatch(removeFlightBall(id)); }, 150);

      registerBall(ackId, performance.now(), getDur(ACK_MS), () => {
        const timeoutId = timeoutRefs.current.get(seq);
        if (timeoutId) clearTimeout(timeoutId);
        timeoutRefs.current.delete(seq);
        dispatch(markPacketAcked(seq));
        setTimeout(() => { if (isMountedRef.current) dispatch(removeFlightBall(ackId)); }, 100);
        resolve();
      });
    });
  });
}, [dispatch, registerBall, getDur]);
```

If TypeScript complains because `sendBatch` references `retransmitPacket` before declaration, move `retransmitPacket` above `sendBatch` and include it in dependency arrays.

- [ ] **Step 6: Replace successful ACK accounting**

In the successful ACK completion callback, replace `dispatch(incrementAcked())` with:

```ts
dispatch(markPacketAcked(seq));
```

Clear timeout handles:

```ts
const timeoutId = timeoutRefs.current.get(seq);
if (timeoutId) clearTimeout(timeoutId);
timeoutRefs.current.delete(seq);
```

- [ ] **Step 7: Run hook-related build**

Run: `npm run build`

Expected: PASS.

---

### Task 6: Add Loss Controls to UI

**Files:**
- Modify: `src/components/CongestionControl/CongestionVisualizer.tsx`

**Interfaces:**
- Consumes: `lossRate`, `dropNextSeq`, `timeoutCount`, `retransmissionCount`, `setLossRate`, `setDropNextSeq` exposed by `useCongestionControl`
- Produces: user controls for loss probability and deterministic next-drop sequence

- [ ] **Step 1: Expose controls from hook**

In `useCongestionControl.ts`, return:

```ts
setLossRate: (v: number) => dispatch(setLossRate(v)),
setDropNextSeq: (v: number | null) => dispatch(setDropNextSeq(v)),
```

- [ ] **Step 2: Add loss-rate buttons**

In the left control panel of `CongestionVisualizer.tsx`, add compact buttons:

```tsx
{[0, 0.05, 0.1, 0.2].map(rate => (
  <Btn
    key={rate}
    $v={lossRate === rate ? 'primary' : undefined}
    onClick={() => setLossRate(rate)}
    disabled={isPlaying}
  >
    {Math.round(rate * 100)}% loss
  </Btn>
))}
```

- [ ] **Step 3: Add deterministic drop controls**

Add a compact input and button pair:

```tsx
<input
  type="number"
  min={1}
  value={dropNextSeq ?? ''}
  onChange={event => {
    const value = Number(event.target.value);
    setDropNextSeq(Number.isFinite(value) && value > 0 ? value : null);
  }}
  disabled={isPlaying}
/>
<Btn onClick={() => setDropNextSeq(window.nextSeq)} disabled={isPlaying}>
  Drop next seq
</Btn>
```

If `window` conflicts with the browser global, destructure the hook state as `congestionWindow`.

- [ ] **Step 4: Show counters**

In the right stats panel, show:

```tsx
<Stat label="Timeouts" value={timeoutCount} />
<Stat label="Retransmits" value={retransmissionCount} />
```

Use the existing stat display pattern in the component.

- [ ] **Step 5: Build UI**

Run: `npm run build`

Expected: PASS.

---

### Task 7: Full Verification

**Files:**
- All modified files from Tasks 1-6

**Interfaces:**
- Consumes: completed service, slice, hook, and UI changes
- Produces: verified RTO retransmission feature

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- congestionService.test.ts congestionSlice.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run existing tests**

Run:

```bash
npm test
```

Expected: PASS, including existing `simulationSlice` and `tcpService` tests.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` updates.

- [ ] **Step 4: Manual smoke test**

Run:

```bash
npm start
```

Open `http://localhost:3000/protocol/congestion`.

Verify:

- With 0% loss, packets fly, ACKs return, and cwnd grows.
- With 20% loss, at least one packet is marked lost, waits for RTO, then retransmits.
- With "Drop next seq", the chosen sequence is dropped exactly once.
- After RTO, cwnd resets to 1 and ssthresh halves.
- Retransmitted packets display as `RTX <seq>`.
- Counters for lost packets, timeouts, and retransmits increase as expected.

---

## Self-Review

- Spec coverage: The plan covers RTO timeout retransmission, random loss rate, deterministic next-drop, cwnd/ssthresh behavior, UI indicators, and tests.
- Placeholder scan: No task uses placeholder language or vague deferred work.
- Type consistency: `InFlightPacket`, `RetransmissionItem`, `LossDecisionConfig`, and action names are consistently used across tasks.
- Scope check: Fast retransmit and triple duplicate ACK are intentionally excluded from this plan and can be added after the RTO flow is stable.
