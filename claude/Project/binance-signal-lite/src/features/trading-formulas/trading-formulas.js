import { deepFreeze } from "../../shared/deep-freeze.js";
import { MARKET_SYMBOLS } from "../../config/marketCatalog.js";

const SUPPORTED_SYMBOLS = MARKET_SYMBOLS;

const RAW_TRADING_FORMULAS = [
  {
    id: "ema-pullback-reclaim-1m",
    name: "1분 EMA 눌림목 복귀",
    description:
      "1분봉 기준 9EMA가 21EMA 위에 있는 상승 추세에서 직전 봉의 눌림 이후 현재 봉이 다시 9EMA 위로 회복하는 순간을 포착합니다.",
    detection: {
      timeframe: "1m",
      symbols: SUPPORTED_SYMBOLS,
      signalType: "trend-continuation",
      maxAlertLatencyMs: 3000,
      conditions: [
        {
          id: "ema-trend-alignment",
          name: "EMA 정렬",
          indicatorRefs: ["ema_9", "ema_21"],
          expression: "ema(9) > ema(21)",
          rationale: "단기 추세가 상방 정렬된 구간만 감지합니다."
        },
        {
          id: "pullback-touch",
          name: "직전 봉 눌림 확인",
          indicatorRefs: ["ema_9", "previous.low"],
          expression: "previous.low <= ema(9)",
          rationale: "직전 봉 저가가 9EMA를 터치하거나 하회해야 합니다."
        },
        {
          id: "close-reclaim",
          name: "현재 봉 회복 마감",
          indicatorRefs: ["current.close", "ema_9", "previous.high"],
          expression: "current.close > ema(9) && current.close > previous.high",
          rationale: "현재 종가가 9EMA와 직전 봉 고가를 동시에 회복해야 합니다."
        }
      ]
    }
  },
  {
    id: "opening-range-breakout-1m",
    name: "1분 거래량 동반 돌파",
    description:
      "1분봉 기준 직전 20개 봉 고점을 종가로 돌파하면서 거래량이 평균 대비 급증하는 모멘텀 진입 구간을 탐지합니다.",
    detection: {
      timeframe: "1m",
      symbols: SUPPORTED_SYMBOLS,
      signalType: "momentum-breakout",
      maxAlertLatencyMs: 3000,
      conditions: [
        {
          id: "range-breakout",
          name: "20봉 고점 돌파",
          indicatorRefs: ["current.close", "highest_high_20"],
          expression: "current.close > highest(high, 20)",
          rationale: "최근 20개 1분봉의 최고가를 종가 기준으로 돌파해야 합니다."
        },
        {
          id: "volume-expansion",
          name: "거래량 확장",
          indicatorRefs: ["current.volume", "sma_volume_20"],
          expression: "current.volume >= sma(volume, 20) * 1.8",
          rationale: "평균 거래량 대비 1.8배 이상일 때만 유효 신호로 봅니다."
        },
        {
          id: "wide-body-close",
          name: "강한 종가 마감",
          indicatorRefs: ["current.close", "current.open", "current.high"],
          expression:
            "(current.close - current.open) / (current.high - current.open) >= 0.6",
          rationale: "봉의 몸통이 충분히 크고 고가 근처에서 마감해야 합니다."
        }
      ]
    }
  },
  {
    id: "bollinger-squeeze-breakout-5m",
    name: "5분 볼린저 스퀴즈 돌파",
    description:
      "5분봉 기준 20기간 볼린저 밴드 폭이 수축한 뒤 거래량과 함께 밴드 밖으로 종가 돌파하는 변동성 확장 구간을 감지합니다.",
    detection: {
      timeframe: "5m",
      symbols: SUPPORTED_SYMBOLS,
      signalType: "volatility-breakout",
      maxAlertLatencyMs: 3000,
      conditions: [
        {
          id: "squeeze-window",
          name: "밴드 폭 수축",
          indicatorRefs: ["bb_width_20_2", "bb_middle_20_2"],
          expression: "max(previous.bbWidthPct, 4) <= 3.5%",
          rationale: "직전 수 개 봉의 볼린저 밴드 폭이 충분히 좁아져 있어야 합니다."
        },
        {
          id: "band-expansion",
          name: "밴드 재확장",
          indicatorRefs: ["current.bbWidthPct", "previous.bbWidthPct"],
          expression: "current.bbWidthPct >= avg(previous.bbWidthPct, 4) * 1.35",
          rationale: "현재 봉에서 밴드 폭이 직전 squeeze 평균 대비 빠르게 확장되어야 합니다."
        },
        {
          id: "outer-band-close",
          name: "밴드 밖 종가 돌파",
          indicatorRefs: ["current.close", "previous.upperBand", "previous.lowerBand", "current.volume", "sma_volume_5"],
          expression:
            "(current.close > previous.upperBand || current.close < previous.lowerBand) && current.volume >= sma(volume, 5) * 1.5",
          rationale: "직전 밴드 경계를 종가로 벗어나고 거래량이 평균 대비 확장되어야 합니다."
        }
      ]
    }
  }
];

export const TRADING_FORMULAS = deepFreeze(RAW_TRADING_FORMULAS);

export const TRADING_FORMULA_IDS = deepFreeze(
  TRADING_FORMULAS.map((formula) => formula.id)
);

export const TRADING_FORMULA_BY_ID = deepFreeze(
  Object.fromEntries(TRADING_FORMULAS.map((formula) => [formula.id, formula]))
);

export const getTradingFormulaById = (formulaId) =>
  TRADING_FORMULA_BY_ID[formulaId] ?? null;
