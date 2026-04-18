# LoL 내전봇 v2 — 수정 워크플로우

> 변경 핵심: 웹페이지 연동 전면 제거 → **봇 전용** / 첫 진입에서 모드 분기

---

## 변경 요약

| 항목 | v1 (기존) | v2 (수정) |
|------|-----------|-----------|
| 웹페이지 연동 | Phase 3~4 계획 | **완전 제거** |
| 첫 선택 | 게임 인원(5v5/4v4/3v3) | **내전모드 / 듀오·스쿼드모드** |
| 내전모드 | 그대로 유지 | 그대로 유지 |
| 듀오·스쿼드모드 | 없음 | **신규 추가** |

---

## 모드 플로우

### A. 내전모드 (기존 유지)

```
/내전 → [내전모드] 버튼
  → 게임 인원 선택 (5vs5 / 4vs4 / 3vs3)
  → 참가 모집 임베드 + 참가/나가기 버튼
  → 인원 충족 → [팀 구성 시작] 버튼
  → 팀 랜덤/밸런스 배정 결과 출력
```

### B. 듀오·스쿼드모드 (신규)

```
/내전 → [듀오·스쿼드] 버튼
  → 파티 크기 선택 (듀오 2 / 트리오 3 / 스쿼드 5)
  → 게임 모드 선택 (솔로랭크 / 자유랭크 / 일반 / 칼바람 / URF / ...)
  → 참가 모집 임베드 + 참가/나가기 버튼
  → 인원 충족 → 완료 메시지 출력 (팀 구성 없음)
```

---

## 구현 단계

### Phase 1 — 진입 분기 버튼 (우선순위 최상)

**목표**: `/내전` 실행 시 모드 선택 화면 출력

**변경 파일**:
- `commands/내전.js` — 기존 즉시 세션 생성 → 모드 선택 임베드로 교체
- `utils/embedBuilder.js` — `buildModeSelectEmbed()` 신규 추가
- `utils/buttonHandler.js` — `mainMode:custom` / `mainMode:party` 핸들러 추가

**UI**:
```
┌─────────────────────────────┐
│  CUSTOM MATCH               │
│  모드를 선택하세요           │
│                             │
│  [⚔ 내전모드]  [👥 듀오·스쿼드] │
└─────────────────────────────┘
```

**버튼 customId**:
- `mainMode:custom` → 기존 내전 플로우 진입
- `mainMode:party` → 듀오·스쿼드 플로우 진입

---

### Phase 2 — 내전모드 분리 (기존 코드 이동)

**목표**: 기존 내전 로직을 `mainMode:custom` 핸들러 아래로 이동

**변경 파일**:
- `utils/buttonHandler.js` — 기존 `mode:` / `join:` / `leave:` / `start:` 핸들러 그대로 유지
- `utils/sessionStore.js` — `sessionType: 'custom' | 'party'` 필드 추가

변경 없이 기존 로직 재사용 가능. 세션 생성을 버튼 핸들러로 이동.

---

### Phase 3 — 듀오·스쿼드모드 구현 (신규)

#### 3-1. 파티 크기 선택

**버튼 customId**: `partySize:{sessionId}:2|3|5`

```
[듀오 2명]  [트리오 3명]  [스쿼드 5명]
```

#### 3-2. 게임 모드 선택

**버튼 customId**: `partyGame:{sessionId}:{gameMode}`

```
[솔로랭크]  [자유랭크]  [일반게임]
[칼바람]    [URF]       [기타]
```

게임 모드 상수:
```js
const PARTY_GAME_MODES = {
  SOLO_RANK:  '솔로랭크',
  FLEX_RANK:  '자유랭크',
  NORMAL:     '일반게임',
  ARAM:       '칼바람',
  URF:        'URF',
  OTHER:      '기타',
};
```

#### 3-3. 참가 모집 임베드

내전모드 임베드와 동일한 Design 19 스타일 사용.
차이점:
- 제목: `듀오 파티 모집` / `트리오 파티 모집` / `스쿼드 파티 모집`
- 인원: `1 / 2`, `1 / 3`, `1 / 5`
- 게임 모드 표시: `솔로랭크` 등
- **[팀 구성 시작] 버튼 없음** → 인원 충족 시 자동 완료 메시지

#### 3-4. 완료 처리

인원 충족 시:
```
파티 완성! 🎮
[닉네임1] [닉네임2] 게임 시작하세요!
모드: 솔로랭크
```

---

### Phase 4 — sessionStore 확장

```js
// createSession 에 type, partySize, partyGameMode 추가
{
  id,
  type: 'custom' | 'party',   // 신규
  hostId,
  hostName,
  mode: null,                  // 내전모드 전용 (5v5 등)
  partySize: null,             // 파티모드 전용 (2|3|5)
  partyGameMode: null,         // 파티모드 전용
  status: 'RECRUITING',
  participants: [],
  messageId: null,
  channelId: null,
  createdAt: Date.now(),
}
```

---

### Phase 5 — embedBuilder 확장

신규 함수:
- `buildModeSelectEmbed()` — 첫 진입 모드 선택 화면
- `buildModeSelectRow()` — [내전모드] [듀오·스쿼드] 버튼
- `buildPartySizeRow(sessionId)` — [듀오] [트리오] [스쿼드] 버튼
- `buildPartyGameRow(sessionId)` — 게임 모드 6개 버튼
- `buildPartyEmbed(session)` — 파티 모집 임베드 (Design 19 기반)

---

## 파일 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `commands/내전.js` | 수정 | 세션 즉시 생성 → 모드 선택 임베드 출력으로 교체 |
| `utils/sessionStore.js` | 수정 | `type`, `partySize`, `partyGameMode` 필드 추가 |
| `utils/embedBuilder.js` | 수정 | 신규 함수 5개 추가 |
| `utils/buttonHandler.js` | 수정 | `mainMode:`, `partySize:`, `partyGame:` 핸들러 추가 |
| `shared/src/types.js` | 수정 | `SESSION_TYPE`, `PARTY_GAME_MODES` 상수 추가 |

---

## 제거 항목 (웹 연동 관련)

- Phase 3 백엔드 API (Express + Socket.io) → **제거**
- Phase 4 프론트엔드 UI → **제거**
- `shared/src/types.js` 의 웹 전용 타입 → **제거**
- 웹 링크 발급 로직 → **제거**

---

## 구현 순서

```
1. shared/types.js 상수 추가
2. sessionStore.js 확장
3. embedBuilder.js 신규 함수 추가
4. commands/내전.js 수정 (모드 선택 화면)
5. buttonHandler.js 에 mainMode 핸들러 추가
6. buttonHandler.js 에 partySize 핸들러 추가
7. buttonHandler.js 에 partyGame 핸들러 추가
8. 파티 모집 join/leave 로직 연결
9. 파티 완성 완료 메시지 구현
10. 테스트
```
