/**
 * Demo seed data for Vitality Spine & Wellness.
 * Used by: scripts/reset-demo.mjs AND app/api/cron/demo-reset/route.ts
 */

export const DEMO_CLINIC_ID  = '95386a93-a473-438d-bb25-c23bcf2d72df'
export const DEMO_LIVE_PID   = '154af0a9-d55f-41cc-95bb-47917fe556c6'
export const DEMO_CLINIC_NAME = 'Vitality Spine & Wellness'

type PatientGroup = 'recovery' | 'stable' | 'declining' | 'volatile' | 'droppedoff' | 'demo_live'

export const DEMO_PATIENTS: Array<{
  id: string; name: string; group: PatientGroup; off: number
}> = [
  { id: 'd8d3b5e4-9194-4941-b9c6-f115fa373f2f', name: 'Marcus',   group: 'recovery',  off:  0 },
  { id: '57822141-204f-4a00-a857-13bfa418d613', name: 'Priya',    group: 'recovery',  off:  1 },
  { id: 'fac3211e-3773-4871-8efb-d58fe1949403', name: 'Tyler',    group: 'recovery',  off: -1 },
  { id: '340015e0-8da4-4b60-99de-3506562cfa41', name: 'Lucia',    group: 'recovery',  off:  1 },
  { id: '3a757d8c-65c8-408e-9921-9b538b55ca40', name: 'James',    group: 'recovery',  off:  0 },
  { id: 'f947e199-e7b4-4dd0-9589-32e0a4d9a7ba', name: 'Natalie',  group: 'recovery',  off: -1 },
  { id: '5b589cc6-2cd5-45c8-8154-ecece293832e', name: 'Ethan',    group: 'recovery',  off:  1 },
  { id: '8654e6d8-797d-40f7-9170-de60f9f08993', name: 'Amara',    group: 'recovery',  off:  0 },
  { id: '9d5b633f-3ec5-4e30-92e3-10dc85eff1a9', name: 'Richard',  group: 'stable',    off:  0 },
  { id: '68f75639-e451-4651-bf0a-a1f2697186ee', name: 'Sofia',    group: 'stable',    off:  1 },
  { id: '01e9454e-403f-4f49-8f60-218517e4d14d', name: 'Derek',    group: 'stable',    off: -1 },
  { id: '628d27e2-50ca-4855-bd5d-35b647d7c62f', name: 'Hannah',   group: 'stable',    off:  1 },
  { id: '0e9c48b6-b63f-4b54-bdcf-c3b3a2c83521', name: 'Omar',     group: 'stable',    off: -1 },
  { id: '49c9ab24-c230-4c0d-b802-d1a1d03fdeab', name: 'Caitlin',  group: 'stable',    off:  0 },
  { id: '18e5c554-ac5a-40fc-bd0d-3dcdc6c9c69d', name: 'Victor',   group: 'declining', off:  0 },
  { id: '116da1ba-59f4-4ba1-92ab-5114c3ade811', name: 'Isabelle', group: 'declining', off:  1 },
  { id: '085b8bda-ff58-4b4c-b552-4090f8a00544', name: 'Andre',    group: 'declining', off: -1 },
  { id: '6f21bd4f-6cc8-4e4a-aa47-db7558ef5a1e', name: 'Grace',    group: 'declining', off:  1 },
  { id: '3fd7716b-5e06-4180-a524-54c309f75a5f', name: 'Noah',     group: 'declining', off:  0 },
  { id: '08c89ebf-0266-4b9a-bfae-898c549247a8', name: 'Dani',     group: 'volatile',  off:  0 },
  { id: 'c944a788-7dd8-459d-ab42-9a5ef1e19a69', name: 'Leon',     group: 'volatile',  off:  2 },
  { id: '38726a74-3ea4-4cd8-9968-b16f09898ec7', name: 'Yuki',     group: 'volatile',  off: -1 },
  { id: '5455c29a-fb67-4615-bd35-c4929db554ba', name: 'Brianna',  group: 'droppedoff',off:  0 },
  { id: '2c034122-c5d4-4d30-b437-4d9c2d0e6635', name: 'Carlos',   group: 'droppedoff',off:  1 },
  { id: '597d95cb-1205-41d7-856d-c165205465fb', name: 'Maya',     group: 'droppedoff',off: -1 },
  { id: DEMO_LIVE_PID,                           name: 'Joshua',   group: 'demo_live', off:  0 },
]

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

export function checkinValues(
  group: PatientGroup,
  dayOffset: number,
  patientIdx: number,
  off: number,
): { pain: number; sq: number; sh: number; en: number; st: number; fn: number; md: number } {
  const df = dayOffset / 20
  const i  = patientIdx + 1
  switch (group) {
    case 'recovery': {
      const n = ((i + dayOffset * 3) % 3) - 1
      return {
        pain: clamp(Math.round(7 - 5*df) + n + off, 0, 10),
        sq:   clamp(Math.round(5 + 3*df) - n,        0, 10),
        sh:   clamp(5.5 + 2.0*df + n*0.4,            4.5, 9.0),
        en:   clamp(Math.round(4 + 4*df) + n,         0, 10),
        st:   clamp(Math.round(7 - 5*df) + n - off,   0, 10),
        fn:   clamp(Math.round(4 + 4*df) - n,         0, 10),
        md:   clamp(Math.round(4 + 4*df) + n,         0, 10),
      }
    }
    case 'stable': {
      const n = ((i * 7 + dayOffset * 4) % 5) - 2
      return {
        pain: clamp(3 + n + off, 1, 5),
        sq:   clamp(7 - n,       5, 10),
        sh:   clamp(7.0 + n*0.3, 6.0, 8.5),
        en:   clamp(7 + n,       5, 10),
        st:   clamp(3 + n,       1, 6),
        fn:   clamp(7 + n - off, 5, 10),
        md:   clamp(7 + n,       5, 10),
      }
    }
    case 'declining': {
      const n = ((i + dayOffset * 5) % 3) - 1
      return {
        pain: clamp(Math.round(3 + 2*df) + n + off, 1, 10),
        sq:   clamp(Math.round(7 - 2*df) + n,        1, 10),
        sh:   clamp(7.0 - 1.0*df + n*0.3,            4.5, 8.5),
        en:   clamp(Math.round(7 - 3*df) + n,         1, 10),
        st:   clamp(Math.round(3 + 3*df) + n,         1, 10),
        fn:   clamp(Math.round(7 - 3*df) + n,         1, 10),
        md:   clamp(Math.round(7 - 2*df) + n - off,   1, 10),
      }
    }
    case 'volatile': {
      const n = ((dayOffset + off + i) % 7)
      if (n <= 1) return { pain: 7, sq: 4, sh: 5.5, en: 3, st: 7, fn: 4, md: 4 }
      if (n <= 3) return { pain: 4, sq: 6, sh: 6.5, en: 5, st: 5, fn: 5, md: 6 }
      if (n <= 5) return { pain: 2, sq: 8, sh: 7.5, en: 8, st: 2, fn: 8, md: 8 }
      return               { pain: 5, sq: 5, sh: 6.0, en: 4, st: 6, fn: 5, md: 5 }
    }
    case 'demo_live': {
      return {
        pain: clamp(Math.round(3 + 3*df), 1, 10),
        sq:   clamp(Math.round(8 - 3*df), 1, 10),
        sh:   clamp(7.5 - 1.5*df,         5.0, 8.5),
        en:   clamp(Math.round(8 - 4*df), 1, 10),
        st:   clamp(Math.round(3 + 4*df), 1, 10),
        fn:   clamp(Math.round(8 - 4*df), 1, 10),
        md:   clamp(Math.round(8 - 3*df), 1, 10),
      }
    }
    case 'droppedoff': {
      const n = ((i * 4 + dayOffset * 3) % 5) - 2
      return {
        pain: clamp(4 + n + off, 1, 8),
        sq:   clamp(6 - n,       4, 9),
        sh:   clamp(7.0 + n*0.3, 5.5, 8.0),
        en:   clamp(6 + n,       3, 9),
        st:   clamp(4 + n,       1, 7),
        fn:   clamp(6 + n,       4, 9),
        md:   clamp(6 + n,       4, 9),
      }
    }
    default: return { pain: 5, sq: 5, sh: 6.5, en: 5, st: 5, fn: 5, md: 5 }
  }
}

/** Compute PURA signal from raw check-in values (mirrors DB trigger logic). */
export function computeSignal(v: ReturnType<typeof checkinValues>): number {
  const sleepNorm = Math.min(v.sh / 8, 1) * 10
  const raw = (10-v.pain)*0.25 + v.sq*0.20 + sleepNorm*0.15 + v.en*0.15 + (10-v.st)*0.10 + v.fn*0.10 + v.md*0.05
  return Math.round(raw * 10)
}
