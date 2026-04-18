# lol-customs-bot v2 — 최종 구현 워크플로우

> 작성일: 2026-03-23
> 전략: Agile / Bot-only / 웹 연동 없음

---

## 현재 상태 스냅샷

### 완료된 기능
| 기능 | 파일 | 상태 |
|------|------|------|
| /내전 슬래시 커맨드 | `commands/내전.js` | ✅ |
| 세션 생성 (인메모리) | `utils/sessionStore.js` | ✅ |
| 모드 선택 (5v5/4v4/3v3) | `utils/embedBuilder.js` + `buttonHandler.js` | ✅ |
| 참가/나가기 버튼 | `utils/buttonHandler.js` | ✅ |
| Design 19 임베드 스타일 | `utils/embedBuilder.js` | ✅ |
| 썸네일: icon-victory.png | `utils/embedBuilder.js` | ✅ |
| 하단 이미지: map-south.png | `utils/embedBuilder.js` | ✅ |
| Riot API 티어 조회 | `utils/riotApi.js` | ✅ |
| 참가 시 티어 자동 갱신 | `utils/buttonHandler.js` | ✅ |
| 평균 티어 표시 | `utils/embedBuilder.js` | ✅ |
| /등록 커맨드 | `commands/등록.js` | ✅ |
| /디자인 커맨드 | `commands/디자인.js` | ✅ |
| /이미지 커맨드 | `commands/이미지.js` | ✅ |

### 제거 대상 (웹 연동 코드)
| 항목 | 파일:라인 | 처리 |
|------|-----------|------|
| `handleStart` 웹 URL 발급 | `buttonHandler.js:132~163` | 팀 구성 임베드로 교체 |
| `registerSessionToServer()` | `buttonHandler.js:170~188` | 완전 삭제 |
| SERVER_URL / CLIENT_URL 의존 | `buttonHandler.js` | 삭제 |

---

## v2 목표 플로우

```
/내전
  └─ [⚔ 내전모드]
       └─ [5v5] [4v4] [3v3]
            └─ 참가 모집
                 └─ 인원 충족 → [팀 구성 시작]
                                  └─ 팀A / 팀B 랜덤 배정 임베드 출력

  └─ [👥 듀오·스쿼드]
       └─ [듀오 2] [트리오 3] [스쿼드 5]
            └─ [솔로랭크] [자유랭크] [일반] [칼바람] [URF] [기타]
                 └─ 참가 모집
                      └─ 인원 충족 → 파티 완성 메시지 출력
```

---

## 구현 단계

### Phase 1 — shared/types.js 상수 추가

**파일**: `shared/src/types.js`

추가 상수:
```js
const SESSION_TYPE = {
  CUSTOM: 'custom',   // 내전모드
  PARTY:  'party',    // 듀오·스쿼드모드
};

const PARTY_SIZES = {
  DUO:   2,
  TRIO:  3,
  SQUAD: 5,
};

const PARTY_GAME_MODES = {
  SOLO_RANK:  'SOLO_RANK',
  FLEX_RANK:  'FLEX_RANK',
  NORMAL:     'NORMAL',
  ARAM:       'ARAM',
  URF:        'URF',
  OTHER:      'OTHER',
};

const PARTY_GAME_MODE_LABELS = {
  SOLO_RANK:  '솔로랭크',
  FLEX_RANK:  '자유랭크',
  NORMAL:     '일반게임',
  ARAM:       '칼바람',
  URF:        'URF',
  OTHER:      '기타',
};
```

---

### Phase 2 — sessionStore.js 확장

**파일**: `utils/sessionStore.js`

`createSession` 파라미터에 `type` 추가:
```js
function createSession(hostId, hostName, type = 'custom') {
  {
    id, type,           // 'custom' | 'party' 추가
    hostId, hostName,
    mode: null,         // 내전모드 전용
    partySize: null,    // 파티모드 전용
    partyGameMode: null,// 파티모드 전용
    status: 'RECRUITING',
    participants: [],
    messageId: null, channelId: null,
    createdAt: Date.now(),
  }
}
```

신규 함수:
```js
function setPartySize(id, size)       // partySize 설정
function setPartyGameMode(id, mode)   // partyGameMode 설정
```

---

### Phase 3 — embedBuilder.js 신규 함수 5개

**파일**: `utils/embedBuilder.js`

| 함수 | 역할 |
|------|------|
| `buildMainModeEmbed()` | 첫 진입 — 내전모드/듀오스쿼드 선택 화면 |
| `buildMainModeRow(sessionId)` | [⚔ 내전모드] [👥 듀오·스쿼드] 버튼 |
| `buildPartySizeRow(sessionId)` | [듀오 2명] [트리오 3명] [스쿼드 5명] 버튼 |
| `buildPartyGameRow(sessionId)` | 게임 모드 6개 버튼 (2줄: 3+3) |
| `buildPartyEmbed(session)` | 파티 모집 임베드 (Design 19 기반) |

`buildMainModeEmbed` 디자인:
```
┌──────────────────────────────┐
│  CUSTOM MATCH          [로고] │
│  모드를 선택해주세요           │
│                              │
│  ─────────────────────────── │
│  내전 또는 파티 모드를         │
│  선택하세요                   │
│                              │
│  [⚔ 내전모드]  [👥 듀오·스쿼드] │
└──────────────────────────────┘
```

`buildPartyEmbed` 디자인:
```
┌──────────────────────────────┐
│  PARTY MATCH           [로고] │
│  듀오 파티 모집               │
│                              │
│  평균 골드  /  솔로랭크        │
│                              │
│  ✓ 주최자  홍길동             │
│  ✓ 인원   1 / 2              │
│  ──────────────────────────  │
│  ✓ 홍길동  `골드`             │
└──────────────────────────────┘
```

---

### Phase 4 — commands/내전.js 수정

**파일**: `commands/내전.js`

현재: 즉시 세션 생성 → 임베드 출력
변경: **세션 생성 없이** mainMode 선택 임베드만 출력

```js
// 변경 전
const session = createSession(...)
await interaction.reply({ embeds: [buildRecruitEmbed(session)], ... })

// 변경 후
await interaction.reply({
  embeds: [buildMainModeEmbed()],
  components: [buildMainModeRow(interaction.id)],  // interaction.id를 임시 key로 사용
})
```

> 세션은 모드 선택 버튼 클릭 시 생성

---

### Phase 5 — buttonHandler.js 핸들러 추가

**파일**: `utils/buttonHandler.js`

#### 5-1. customId 라우팅 확장

```js
switch (action) {
  case 'mainMode':   await handleMainMode(interaction, extra); break;  // 신규
  case 'partySize':  await handlePartySize(interaction, session, extra); break; // 신규
  case 'partyGame':  await handlePartyGame(interaction, session, extra); break; // 신규
  case 'partyJoin':  await handlePartyJoin(interaction, session); break; // 신규
  case 'partyLeave': await handlePartyLeave(interaction, session); break; // 신규
  case 'mode':    ...  // 기존 유지
  case 'join':    ...  // 기존 유지
  case 'leave':   ...  // 기존 유지
  case 'start':   ...  // 수정 (Phase 6)
}
```

#### 5-2. handleMainMode (신규)

```
customId: "mainMode:{interactionId}:custom" | "mainMode:{interactionId}:party"
```
- `custom` → 세션 생성 (type:'custom') → 기존 내전 임베드 + 모드/참가 버튼
- `party` → 세션 생성 (type:'party') → 파티 크기 선택 임베드

#### 5-3. handlePartySize (신규)

```
customId: "partySize:{sessionId}:2|3|5"
```
- partySize 저장 → 게임 모드 선택 임베드 + 버튼 출력

#### 5-4. handlePartyGame (신규)

```
customId: "partyGame:{sessionId}:SOLO_RANK|FLEX_RANK|..."
```
- partyGameMode 저장 → 파티 모집 임베드 + 참가/나가기 버튼 출력

#### 5-5. handlePartyJoin / handlePartyLeave (신규)

- 내전 join/leave와 동일 로직
- 인원 충족 시 → 파티 완성 메시지 출력 (버튼 제거)

```
파티 완성! 🎮
솔로랭크 듀오 준비됐습니다.
홍길동, 김철수 — 게임 고고!
```

---

### Phase 6 — handleStart 수정 (웹 제거 + 팀 구성)

**파일**: `utils/buttonHandler.js:handleStart`

현재: 웹 URL 발급 → 링크 임베드 출력
변경: **랜덤 팀 구성 → 팀A / 팀B 임베드 출력**

```js
async function handleStart(interaction, session) {
  if (interaction.user.id !== session.hostId) { ... }

  // 참가자 랜덤 셔플
  const shuffled = [...session.participants].sort(() => Math.random() - 0.5);
  const half = Math.floor(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);

  // 팀 구성 임베드 출력
  const teamEmbed = buildTeamEmbed(session, teamA, teamB);
  await interaction.update({ embeds: [teamEmbed], components: [] });
}
```

`buildTeamEmbed(session, teamA, teamB)` — embedBuilder.js에 추가:
```
┌──────────────────────────────┐
│  팀 구성 완료!         [로고] │
│  5 vs 5  내전                │
│                              │
│  🔵 블루팀                    │
│  ✓ 홍길동 `다이아`            │
│  ✓ 김철수 `골드`              │
│  ...                         │
│                              │
│  🔴 레드팀                    │
│  ✓ 이영희 `플래티넘`          │
│  ...                         │
└──────────────────────────────┘
```

---

### Phase 7 — 불필요 코드 정리

**파일**: `utils/buttonHandler.js`
- `registerSessionToServer()` 함수 전체 삭제
- `SERVER_URL`, `CLIENT_URL` 참조 삭제
- axios 호출 삭제 (buttonHandler 내 웹 통신 전부 제거)

---

## 파일별 변경 요약

| 파일 | 변경 유형 | 주요 내용 |
|------|-----------|-----------|
| `shared/src/types.js` | 추가 | SESSION_TYPE, PARTY_SIZES, PARTY_GAME_MODES |
| `utils/sessionStore.js` | 수정 | type/partySize/partyGameMode 필드, setter 함수 2개 |
| `utils/embedBuilder.js` | 추가 | 신규 함수 6개 (mainMode, partySizeRow, partyGameRow, partyEmbed, teamEmbed + mainModeRow) |
| `commands/내전.js` | 수정 | 즉시 세션 생성 제거 → mainMode 선택 화면 |
| `utils/buttonHandler.js` | 수정+삭제 | 핸들러 5개 추가, registerSessionToServer 삭제, handleStart 교체 |

---

## 구현 순서 (의존성 순)

```
1. shared/types.js          ← 상수 추가 (독립)
2. sessionStore.js          ← types.js 의존
3. embedBuilder.js          ← types.js 의존
4. commands/내전.js         ← embedBuilder.js 의존
5. buttonHandler.js         ← 전부 의존 (마지막)
6. 봇 재시작 & 테스트
```

---

## 테스트 체크리스트

### 내전모드
- [ ] /내전 → 모드 선택 화면 출력
- [ ] [내전모드] 클릭 → 기존 5v5/4v4/3v3 화면
- [ ] 참가/나가기 정상 동작
- [ ] 인원 충족 → [팀 구성 시작] 버튼 출현
- [ ] 팀 구성 → 블루/레드팀 임베드 출력
- [ ] 주최자 외 팀 구성 시작 불가

### 듀오·스쿼드모드
- [ ] [듀오·스쿼드] 클릭 → 파티 크기 선택 화면
- [ ] 파티 크기 선택 → 게임 모드 선택 화면
- [ ] 게임 모드 선택 → 파티 모집 임베드
- [ ] 참가/나가기 정상 동작
- [ ] 인원 충족 → 파티 완성 메시지 출력 (버튼 제거)

### 공통
- [ ] 만료 세션 접근 시 안내 메시지
- [ ] 티어 미등록 유저 참가 시 에러 없이 동작
