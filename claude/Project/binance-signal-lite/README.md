# Binance Signal Lite

개인용 초경량 모의매매 웹앱입니다. 로그인 없이 브라우저 하나에서 다음만 처리합니다.

- BTCUSDT, ETHUSDT 실시간 차트
- `1m`, `5m` 시간봉 전환
- 사전 정의된 매매법 3개 감지
- 공식 일치 시 브라우저 내 알림 이력 표시
- 선택한 신호를 주문 패널에 적용해 가상 금전으로 수동 진입
- 알림 이력, 주문 이력, 가상 잔고의 `localStorage` 유지

## 구성

- `index.html`: 정적 엔트리 파일
- `src/main.js`: 앱 시작점
- `src/app.js`: 화면 셸과 차트, 알림, 주문 패널 조립
- `src/components/chartCard.js`: 차트 카드 UI와 캔버스 렌더링
- `src/components/alertInboxPanel.js`: 감지된 공식 알림 목록과 적용 버튼 UI
- `src/components/mockOrderPanel.js`: 가상 주문 입력, 잔고, 주문 이력 UI
- `src/components/monitoringTimeframePicker.js`: 활성 감시 시간봉 선택 UI
- `src/components/tradingFormulaPanel.js`: 고정 트레이딩 공식 목록과 상세 보기 UI
- `src/config/monitoringTimeframes.js`: 앱의 활성 시간봉 설정과 `localStorage` 복원 규칙
- `src/data/chartPanels.js`: 종목/시간봉 패널 정의
- `src/features/alerts/browserSignalAlertStore.js`: 공식 일치 알림 이력 `localStorage` 저장소
- `src/features/orders/mockOrderLedger.js`: 가상 잔고와 수동 주문 이력 저장소
- `src/features/signals/formulaMatchMonitor.js`: 실시간 캔들 스냅샷에서 공식 일치 여부 판정
- `src/features/trading-formulas/trading-formulas.js`: 수정 불가한 3개 트레이딩 공식 정의
- `src/lib/mockCandles.js`: 네트워크 불가 시 폴백용 더미 캔들 데이터 생성
- `src/services/binanceMarketDataClient.js`: Binance REST/결합 스트림 저수준 클라이언트
- `src/services/binanceChartFeed.js`: 선택 가능한 시간봉 패널의 시드 조회와 실시간 kline 병합 계층
- `src/styles.css`: 전체 레이아웃 및 테마 스타일

## 실행

```bash
cd /workspaces/workspace/claude/Project/binance-signal-lite
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`에 접속하면 시간봉 선택기, 알림 패널, 차트 2개, 공식 상세, 가상 주문 패널이 보입니다. 각 차트는 Binance 공식 API에서 받은 캔들 데이터를 로드한 뒤 실시간으로 갱신됩니다.

초기 활성 시간봉은 쿼리스트링으로도 줄 수 있습니다.

```text
http://localhost:4173/?timeframe=5m
```

선택한 시간봉은 브라우저 `localStorage`에 저장되어 다음 실행 시 그대로 복원됩니다.

## 현재 MVP 동작

- 시간봉은 `1m`, `5m`만 앱에서 선택합니다.
- 공식은 3개로 고정되어 있으며 사용자가 편집할 수 없습니다.
- 공식이 일치하면 알림 패널에 즉시 쌓입니다.
- 알림에서 `주문에 적용`을 누르면 주문 패널에 심볼/시간봉/공식/참고 진입가가 채워집니다.
- 가상 주문은 잔고를 증감시키는 경량 ledger 방식으로만 처리합니다.
- 포지션 관리, 손익 계산, 계정, 외부 푸시 알림은 아직 넣지 않았습니다.

## 테스트

```bash
cd /workspaces/workspace/claude/Project/binance-signal-lite
npm test
```

- Binance 실시간 시드/스트림 병합
- 3개 공식의 규칙 판정
- `1m`·`5m` 시간봉 설정과 복원
- 알림 이력 저장과 중복 방지
- 가상 주문 기록과 잔고 반영
