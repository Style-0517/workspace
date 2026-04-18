# 균열지대 (Rift Zone) - Implementation Workflow

## Project Overview
- **Type**: Browser Game (Phaser 3 + TypeScript + Vite)
- **Genre**: 탑다운 생존 시뮬레이션 (좀보이드 + 림월드 + 로보토미코퍼레이션 융합)
- **Core Mechanic**: 공명(Resonance) 시스템
- **Target**: `/workspaces/workspace/claude/Project/rift-zone/`

---

## Dependency Graph

```
Phase 0 (초기화)
  └→ Phase 1 (타일맵/카메라) ──── CP1 ✓ 맵 표시 확인
       ├→ Phase 2 (생존자)  ──┐
       ├→ Phase 3 (자원/UI)   ├── CP2 ✓ 생존자+UI 작동 확인
       │    └→ Phase 4 (시간) ─┘
       └→ Phase 7 (건축) ─────┐
                               │
       Phase 5 (이상체) ←──────┤── CP3 ✓ 이상체+공명 핵심 루프 확인
            └→ Phase 6 (공명)──┘
                 └→ Phase 8 (이벤트) ── CP4 ✓ 게임이 돌아가는 느낌
                      └→ Phase 9 (탐험/전투)
                           └→ Phase 10 (저장/폴리시) ── CP5 ✓ 완성
```

---

## Phase 0: 프로젝트 초기화
**목표**: 빌드 가능한 Phaser 3 + TypeScript 프로젝트 뼈대

| Task | 파일 | 설명 |
|------|------|------|
| 0-1 | `package.json` | Vite + Phaser 3 + TypeScript 의존성 |
| 0-2 | `vite.config.ts` | Vite 설정 |
| 0-3 | `tsconfig.json` | TypeScript 설정 |
| 0-4 | `index.html` | 엔트리 HTML |
| 0-5 | `src/main.ts` | Phaser 게임 인스턴스 생성 |
| 0-6 | `src/core/EventBus.ts` | 전역 이벤트 시스템 |
| 0-7 | `src/utils/Constants.ts` | 게임 상수 |

**검증**: `npm run dev` → 빈 Phaser 캔버스 표시

---

## Phase 1: 타일맵 + 카메라
**목표**: 타일 기반 맵이 렌더링되고 카메라 이동/줌 가능

| Task | 파일 | 설명 |
|------|------|------|
| 1-1 | `src/scenes/BootScene.ts` | 에셋 로딩 씬 |
| 1-2 | `src/scenes/MainScene.ts` | 메인 게임 씬 |
| 1-3 | `src/map/TileMapManager.ts` | 프로시저럴 타일맵 생성 |
| 1-4 | 카메라 컨트롤 | WASD/드래그 이동, 스크롤 줌 |

**검증 (CP1)**: 맵이 보이고 카메라 이동 가능

---

## Phase 2: 생존자 시스템
**목표**: 성격/스킬/주파수를 가진 생존자가 맵에 표시

| Task | 파일 | 설명 |
|------|------|------|
| 2-1 | `src/data/survivors.json` | 이름/성격/배경 데이터 풀 |
| 2-2 | `src/entities/Survivor.ts` | 생존자 클래스 (성격, 스킬, 주파수, 상태) |
| 2-3 | `src/entities/SurvivorGenerator.ts` | 랜덤 생존자 생성기 |
| 2-4 | `src/systems/SurvivalSystem.ts` | 배고픔/피로/체력/정신오염도 |
| 2-5 | `src/systems/TaskSystem.ts` | 작업 배치 (대기/탐험/연구/건축/방어) |
| 2-6 | 생존자 이동 AI | 배치된 작업 위치로 이동 |

---

## Phase 3: 자원 관리 + UI
**목표**: 자원 시스템 작동 + HUD로 정보 표시

| Task | 파일 | 설명 |
|------|------|------|
| 3-1 | `src/systems/ResourceSystem.ts` | 5종 자원 관리 |
| 3-2 | `src/scenes/UIScene.ts` | UI 오버레이 씬 |
| 3-3 | `src/ui/HUD.ts` | 상단바: 자원, 시간, 인구 |
| 3-4 | `src/ui/SurvivorPanel.ts` | 생존자 상세 (클릭 시) |
| 3-5 | `src/ui/EventLog.ts` | 하단 이벤트 로그 |

---

## Phase 4: 시간 시스템
**목표**: 하루 사이클이 돌아가고 사이클별 로직 트리거

| Task | 파일 | 설명 |
|------|------|------|
| 4-1 | `src/core/TimeSystem.ts` | 게임 내 시간 (속도 조절: 일시정지/1x/2x/3x) |
| 4-2 | 사이클 이벤트 | 아침→낮→밤→결산 트리거 |
| 4-3 | HUD 시간 표시 | 현재 시각 + 사이클 단계 |

**검증 (CP2)**: 생존자 표시, UI 작동, 시간 흐름 확인

---

## Phase 5: 이상체 시스템
**목표**: 이상체 수용/연구/탈주 기본 메커닉

| Task | 파일 | 설명 |
|------|------|------|
| 5-1 | `src/data/anomalies.json` | 이상체 데이터 (이름, 등급, 주파수, 설명, 탈주조건) |
| 5-2 | `src/entities/Anomaly.ts` | 이상체 클래스 |
| 5-3 | `src/entities/AnomalyRegistry.ts` | 보유 이상체 목록 관리 |
| 5-4 | `src/systems/ContainmentSystem.ts` | 수용 관리 (시설 할당, 상태 모니터링) |
| 5-5 | `src/systems/ResearchSystem.ts` | 연구 진행도 + 정보 해금 |
| 5-6 | `src/ui/AnomalyPanel.ts` | 이상체 상세 패널 |

---

## Phase 6: 공명 시스템 (핵심 차별점)
**목표**: 생존자↔이상체 주파수 매칭 + 결과 시스템

| Task | 파일 | 설명 |
|------|------|------|
| 6-1 | `src/systems/ResonanceSystem.ts` | 주파수 매칭 알고리즘 + 결과 계산 |
| 6-2 | `src/ui/ResonanceUI.ts` | 배치 전 공명 예측 표시 |
| 6-3 | 정신 오염 연동 | 공명 결과→정신오염도 변화 |
| 6-4 | 변질 시스템 | 오염도 한계 초과 시 생존자 변이 |

**검증 (CP3)**: 생존자를 이상체에 배치→공명 결과 표시→연구 진행 확인

---

## Phase 7: 건축 시스템
**목표**: 격자 기반 건물 배치

| Task | 파일 | 설명 |
|------|------|------|
| 7-1 | `src/data/buildings.json` | 건물 데이터 (종류, 비용, 크기, 효과) |
| 7-2 | `src/map/BuildingSystem.ts` | 건물 배치/철거 로직 |
| 7-3 | `src/ui/BuildMenu.ts` | 건축 메뉴 UI |
| 7-4 | 건물 종류 | 거주, 수용실, 연구실, 방벽, 창고, 의무실 |

---

## Phase 8: 이벤트 시스템 (스토리텔러)
**목표**: 가중 랜덤 이벤트로 게임에 긴장감과 드라마

| Task | 파일 | 설명 |
|------|------|------|
| 8-1 | `src/data/events.json` | 이벤트 데이터 (조건, 확률, 효과) |
| 8-2 | `src/systems/EventSystem.ts` | 스토리텔러: 가중 랜덤 이벤트 선택 |
| 8-3 | 이벤트 타입 구현 | 균열폭증, NPC갈등, 외부생존자, 탈주, 자원발견 |
| 8-4 | 난이도 스케일링 | 시간 경과에 따른 이벤트 강도 증가 |

**검증 (CP4)**: 이벤트가 발생하고 게임 상태에 영향, "게임이 돌아가는" 느낌

---

## Phase 9: 탐험/전투
**목표**: 외부 탐험 + 이상체 포획 + 전투

| Task | 파일 | 설명 |
|------|------|------|
| 9-1 | `src/map/ExplorationSystem.ts` | 탐험 파견 로직 |
| 9-2 | `src/systems/CombatSystem.ts` | 실시간 일시정지 전투 |
| 9-3 | 이상체 포획 | 전투 후 포획 판정 |
| 9-4 | 루팅 시스템 | 탐험 보상 (자원, 아이템) |
| 9-5 | 탐험 UI | 탐험 결과 리포트 |

---

## Phase 10: 저장/로드 + 폴리시
**목표**: 완성된 게임 루프

| Task | 파일 | 설명 |
|------|------|------|
| 10-1 | `src/utils/SaveManager.ts` | IndexedDB 저장/로드 |
| 10-2 | 게임 오버 조건 | 전원 사망 / 거점 파괴 |
| 10-3 | 밸런싱 패스 | `config.json` 수치 조정 |
| 10-4 | 타이틀 화면 | 새 게임 / 이어하기 |

**검증 (CP5)**: 전체 게임 루프 완성, 저장/로드 작동

---

## Module Structure

```
/rift-zone
  /src
    /core           ← 게임 엔진 코어
    /scenes         ← Phaser 씬
    /entities       ← 생존자, 이상체
    /systems        ← 게임 시스템 (10개 모듈)
    /map            ← 타일맵, 건축, 탐험
    /ui             ← UI 컴포넌트 (7개 모듈)
    /data           ← JSON 데이터
    /utils          ← 유틸리티
  /assets
    /sprites
    /tiles
  index.html
  vite.config.ts
  tsconfig.json
  package.json
```

---

## Implementation Notes
- **그래픽**: 초기엔 색상 사각형(placeholder)으로 시작, 나중에 스프라이트 교체
- **테스트**: 각 Phase 완료 시 브라우저에서 즉시 확인
- **모듈화**: 각 시스템은 독립적, EventBus로 통신
- **데이터 드리븐**: 밸런스는 JSON으로 분리, 코드 수정 없이 조정 가능
