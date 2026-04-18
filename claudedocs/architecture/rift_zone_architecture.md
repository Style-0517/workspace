# 균열지대 (Rift Zone) - System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Phaser Game                        │
├────────────┬─────────────┬──────────────────────────┤
│ BootScene  │ MainScene   │       UIScene             │
│ (에셋로딩) │ (게임로직)  │  (HUD / 패널 / 메뉴)     │
├────────────┴─────────────┴──────────────────────────┤
│              EventBus (타입 안전 전역 이벤트)         │
├─────────────────────────────────────────────────────┤
│  Systems Layer (각 시스템은 EventBus로만 상호 통신)   │
│  ┌───────────┬────────────┬─────────────┐           │
│  │TimeSystem │ TaskSystem │ResourceSys  │           │
│  │EventSystem│ CombatSys  │SurvivalSys  │           │
│  │ResonanceSys│ContainSys │ResearchSys  │           │
│  └───────────┴────────────┴─────────────┘           │
├─────────────────────────────────────────────────────┤
│  Entities Layer                                      │
│  ┌──────────┬───────────┬───────────┐               │
│  │ Survivor │ Anomaly   │ Building  │               │
│  └──────────┴───────────┴───────────┘               │
├─────────────────────────────────────────────────────┤
│  Map Layer                                           │
│  ┌───────────────┬──────────────┬──────────────┐    │
│  │TileMapManager │BuildingSystem│ExplorationSys│    │
│  └───────────────┴──────────────┴──────────────┘    │
├─────────────────────────────────────────────────────┤
│  Data (JSON) │ SaveManager │ Utils │ Constants       │
└─────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. 경량 컴포넌트 패턴 (ECS 아님)
- 풀 ECS는 과도 → Phaser의 OOP 구조와 자연스러운 클래스 기반
- Entity = 일반 TypeScript 클래스 (Survivor, Anomaly)
- System = 관련 엔티티 배열을 순회하며 update()
- EventBus로 시스템 간 디커플링

### 2. EventBus 기반 통신
시스템들은 서로를 직접 import하지 않음. EventBus로만 소통.

```typescript
// 이벤트 타입 정의
enum GameEvents {
  // 시간
  TIME_TICK = 'time:tick',
  TIME_PHASE_CHANGED = 'time:phase',

  // 생존자
  SURVIVOR_ASSIGNED = 'survivor:assigned',
  SURVIVOR_STATUS_CHANGED = 'survivor:status',
  SURVIVOR_CORRUPTED = 'survivor:corrupted',
  SURVIVOR_DIED = 'survivor:died',

  // 이상체
  ANOMALY_CONTAINED = 'anomaly:contained',
  ANOMALY_BREACH = 'anomaly:breach',
  ANOMALY_RESEARCH_COMPLETE = 'anomaly:researched',

  // 공명
  RESONANCE_RESULT = 'resonance:result',

  // 자원
  RESOURCE_CHANGED = 'resource:changed',
  RESOURCE_DEPLETED = 'resource:depleted',

  // 이벤트
  STORY_EVENT = 'event:story',

  // 건축
  BUILDING_PLACED = 'building:placed',
  BUILDING_DESTROYED = 'building:destroyed',

  // UI
  UI_SELECT_SURVIVOR = 'ui:select:survivor',
  UI_SELECT_ANOMALY = 'ui:select:anomaly',
}
```

---

## Core Type Definitions

### Frequency System (주파수)
```typescript
enum FrequencyType {
  Frost = 'frost',       // 빙결
  Blaze = 'blaze',       // 연소
  Abyss = 'abyss',       // 심연
  Radiance = 'radiance', // 광휘
  Chaos = 'chaos'        // 혼돈
}

interface Frequency {
  type: FrequencyType;
  intensity: number; // 1-10
}
```

### Survivor (생존자)
```typescript
enum Trait {
  Brave = 'brave',
  Coward = 'coward',
  Analytical = 'analytical',
  Intuitive = 'intuitive',
  Empathic = 'empathic',
  Cold = 'cold',
  Reckless = 'reckless',
  Cautious = 'cautious',
  Leader = 'leader',
  Loner = 'loner'
}

enum TaskType {
  Idle = 'idle',
  Explore = 'explore',
  Research = 'research',
  Build = 'build',
  Defend = 'defend',
  Medical = 'medical',
  Rest = 'rest'
}

interface Skills {
  combat: number;      // 0-10
  building: number;
  medical: number;
  research: number;
  negotiation: number;
}

interface SurvivorStatus {
  health: number;        // 0-100
  hunger: number;        // 0-100 (높을수록 배고픔)
  fatigue: number;       // 0-100 (높을수록 피곤)
  contamination: number; // 0-100 (정신 오염도)
  morale: number;        // 0-100
}

interface SurvivorData {
  id: string;
  name: string;
  age: number;
  background: string;
  traits: Trait[];      // 2-3개
  frequency: Frequency; // 성격에서 자동 결정
  skills: Skills;
  status: SurvivorStatus;
  currentTask: TaskType;
  relationships: Map<string, number>; // survivorId → -100~100
}
```

### Anomaly (이상체)
```typescript
enum AnomalyGrade {
  Safe = 'safe',
  Unstable = 'unstable',
  Danger = 'danger',
  Calamity = 'calamity'
}

interface AnomalyData {
  id: string;
  name: string;
  codename: string;        // "RZ-001" 형식
  grade: AnomalyGrade;
  frequency: Frequency;
  description: string;      // 연구 진행에 따라 해금
  containmentReq: string;   // 필요 시설 타입
  breachCondition: string;  // 탈주 조건 설명
  breachThreshold: number;  // 탈주 확률 기준값
  researchProgress: number; // 0-100
  isContained: boolean;
  assignedSurvivorId: string | null;
}
```

### Time System (시간)
```typescript
enum TimePhase {
  Morning = 'morning',     // 06:00-12:00 (계획)
  Day = 'day',             // 12:00-18:00 (실행)
  Night = 'night',         // 18:00-00:00 (위기)
  Settlement = 'settlement' // 00:00-06:00 (결산)
}

enum GameSpeed {
  Paused = 0,
  Normal = 1,
  Fast = 2,
  Fastest = 3
}

// 1 게임 내 하루 ≈ 실제 10-15분 (1x 속도)
// 1 틱 = 1 게임 내 분 ≈ 실제 0.4-0.6초
```

---

## Resonance Algorithm (공명 알고리즘)

### Trait → Frequency 매핑
```
[Analytical, Cold]     → Frost (빙결)
[Brave, Reckless]      → Blaze (연소)
[Intuitive, Loner]     → Abyss (심연)
[Empathic, Leader]     → Radiance (광휘)
특성 충돌 or 3개 이상   → Chaos (혼돈)
```

### Frequency Compatibility Matrix (상성표)
```
           Frost  Blaze  Abyss  Radiance  Chaos
Frost       +50   -30    +30    +10       ±20
Blaze       -30   +50    +10    +30       ±20
Abyss       +30   +10    +50    -30       ±20
Radiance    +10   +30    -30    +50       ±20
Chaos       ±20   ±20    ±20    ±20       ±40
```
- 대각선(동일 타입): +50
- 상생(Frost↔Abyss, Blaze↔Radiance): +30
- 상극(Frost↔Blaze, Abyss↔Radiance): -30
- Chaos: 랜덤 범위

### Resonance Score Calculation
```
baseScore = compatibilityMatrix[survivor.freq.type][anomaly.freq.type]
intensityBonus = 10 - abs(survivor.freq.intensity - anomaly.freq.intensity)
randomVariance = random(-5, +5)
finalScore = baseScore + intensityBonus + randomVariance
```

### Result Thresholds
| Score | Result | 연구속도 | 오염 증가 | 특수효과 |
|-------|--------|---------|----------|---------|
| 60+   | Harmony (완전 공명) | ×2.0 | +3/시간 | 특수능력 확률 |
| 30-59 | Partial (부분 공명) | ×1.0 | +1/시간 | 없음 |
| 0-29  | Weak (미약)        | ×0.5 | +0.5/시간 | 없음 |
| <0    | Discord (불협화음)  | ×0.2 | +5/시간 | 사고 30%, 탈주 위험 |

---

## Contamination System (정신 오염)

| 범위 | 상태 | 효과 |
|------|------|------|
| 0-30 | 정상 | 없음 |
| 31-60 | 불안정 | 작업 효율 -20%, 가끔 이상 행동 |
| 61-80 | 위험 | 효율 -50%, NPC 충돌, 환각 |
| 81-99 | 임계 | 작업 불가, 격리 필요 |
| 100 | 변질 | 돌이킬 수 없음 (이상체화 또는 사망) |

회복: 휴식(Rest 작업), 의료(Medicine 자원 소모), 다른 생존자 교류(관계 보너스)

---

## Storyteller Algorithm (스토리텔러 이벤트)

### Event Structure
```typescript
interface GameEvent {
  id: string;
  type: 'crisis' | 'opportunity' | 'social' | 'anomaly' | 'environmental';
  severity: 1 | 2 | 3 | 4 | 5;
  conditions: EventCondition[];
  baseWeight: number;
  cooldown: number; // 게임 내 일 수
  effects: EventEffect[];
  description: string;
}
```

### Tension Curve (텐션 커브)
```
가중치 조정 규칙:
1. 최근 3일 위기 없음 → crisis 가중치 ×2
2. 자원 풍족 (모든 자원 > 70%) → crisis 가중치 ×1.5
3. 자원 부족 (어떤 자원 < 20%) → opportunity 가중치 ×2
4. 평균 사기 < 30 → social(긍정) 가중치 ×2
5. 경과 일수 / 10 → severity 상한 (초반엔 약한 이벤트만)
6. 하루 최대 이벤트: 1~2개
```

---

## Save/Load Strategy

### GameState Interface
```typescript
interface GameState {
  version: string;
  timestamp: number;
  time: { day: number; hour: number; minute: number; phase: TimePhase; speed: GameSpeed };
  resources: Record<ResourceType, number>;
  survivors: SurvivorData[];
  anomalies: AnomalyData[];
  map: { tiles: number[][]; buildings: BuildingState[] };
  research: Record<string, number>;
  events: { history: string[]; cooldowns: Record<string, number> };
  stats: GameStats;
}
```

### Serialization
- 모든 Entity/System은 `serialize(): object` + `deserialize(data: object): void` 구현
- IndexedDB 사용 (LocalStorage 5MB 제한 회피)
- 자동 저장: 매 게임 내 하루 결산 시
- 수동 저장: ESC 메뉴

---

## System Update Order (매 틱)

```
1. TimeSystem.update(delta)        → 시간 진행
2. SurvivalSystem.update(delta)    → 배고픔/피로/체력 변화
3. TaskSystem.update(delta)        → 작업 진행
4. ResonanceSystem.update(delta)   → 공명 효과 적용 (오염도 변화)
5. ResearchSystem.update(delta)    → 연구 진행
6. ContainmentSystem.update(delta) → 이상체 상태 체크, 탈주 판정
7. ResourceSystem.update(delta)    → 자원 소모/생산 정산
8. EventSystem.update(delta)       → 이벤트 판정 (사이클 변경 시)
9. CombatSystem.update(delta)      → 전투 진행 (있을 경우)
```

---

## Implementation Principles
1. **시스템 간 직접 참조 금지** → EventBus로만 통신
2. **데이터 드리븐** → 밸런스 수치는 전부 JSON
3. **직렬화 가능** → 모든 런타임 상태는 저장/복원 가능
4. **점진적 구축** → Phase 순서대로, 각 Phase에서 독립적으로 테스트 가능
