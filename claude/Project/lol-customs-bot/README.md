# 롤 내전 봇 (LoL Customs Bot)

디스코드에서 `/내전` 커맨드 하나로 팀 구성까지 자동화하는 롤 내전 도우미

## 기능

- `/내전` 커맨드로 인원 모집 시작
- 버튼으로 5v5 / 4v4 / 3v3 모드 선택
- 참가 버튼 클릭 → 자동 인원 카운트
- 인원 충족 시 웹 링크 자동 발급
- 웹에서 밸런스 팀 구성 or 순서 팀 구성 선택
- 결과 디스코드 채널에 공유

## 프로젝트 구조

```
lol-customs-bot/
├── bot/          ← 디스코드 봇 (discord.js)
├── server/       ← 백엔드 API (Express + Socket.io)
├── client/       ← 프론트엔드 (React)
├── shared/       ← 공통 타입/상수
└── .env.example  ← 환경변수 예시
```

## 시작하기

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일에 토큰/키 입력
```

### 2. 패키지 설치

```bash
cd bot && npm install
cd ../server && npm install
cd ../client && npm install
```

### 3. 슬래시 커맨드 등록 (최초 1회)

```bash
cd bot
node src/commands/deploy.js
```

### 4. 실행

터미널 2개 열어서:

```bash
# 터미널 1 - 서버
cd server && npm run dev

# 터미널 2 - 봇
cd bot && npm run dev
```

## 필요한 키

| 키 | 발급 위치 |
|----|----------|
| DISCORD_BOT_TOKEN | https://discord.com/developers/applications |
| DISCORD_CLIENT_ID | 위 사이트 → Application ID |
| RIOT_API_KEY | https://developer.riotgames.com |
