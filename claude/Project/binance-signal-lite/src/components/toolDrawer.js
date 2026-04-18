import {
  APP_BRAND_NAME,
  APP_BRAND_SUBLABEL,
} from "../config/branding.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSectionTitle(sectionId) {
  switch (sectionId) {
    case "market":
      return "종목";
    case "alerts":
      return "알림";
    case "formula":
      return "공식";
    case "settings":
      return "설정";
    default:
      return sectionId;
  }
}

function getSectionDescription(sectionId) {
  switch (sectionId) {
    case "market":
      return "현재 화면에 띄울 종목을 고릅니다.";
    case "alerts":
      return "일치한 매매법 알림을 확인합니다.";
    case "formula":
      return "내장 전략 조건을 확인합니다.";
    case "settings":
      return "화면과 테마를 바꿉니다.";
    default:
      return "";
  }
}

function getDrawerMarkup({
  isOpen,
  activeSection,
  summary,
} = {}) {
  const sections = ["alerts", "formula", "settings"];
  const orderedSections = sections;

  return `
    <div class="tool-drawer__overlay${isOpen ? " is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}">
      <button type="button" class="tool-drawer__backdrop" data-action="close-drawer" aria-label="서랍 닫기"></button>
      <div class="tool-drawer__sheet">
        <div class="tool-drawer__sheet-header">
          <div class="tool-drawer__sheet-title">
            <small>${escapeHtml(APP_BRAND_NAME)}</small>
            <strong>${escapeHtml(APP_BRAND_SUBLABEL)}</strong>
          </div>
          <button type="button" class="tool-drawer__close" data-action="close-drawer" aria-label="서랍 닫기">닫기</button>
        </div>
        <div class="tool-drawer__summary">
          <span>${escapeHtml(summary.symbol)}</span>
          <span>${escapeHtml(summary.timeframe)}</span>
          <span>미확인 ${escapeHtml(summary.alertCount)}</span>
        </div>
        <div class="tool-drawer__sections">
          ${orderedSections.map((sectionId) => `
            <section class="tool-drawer__section${sectionId === activeSection ? " is-active" : ""}">
              <button
                type="button"
                class="tool-drawer__section-trigger"
                data-action="set-section"
                data-section="${sectionId}"
                aria-expanded="${sectionId === activeSection}"
              >
                <span>
                  <strong>${getSectionTitle(sectionId)}</strong>
                  <small>${getSectionDescription(sectionId)}</small>
                </span>
                <span class="tool-drawer__section-arrow">${sectionId === activeSection ? "−" : "+"}</span>
              </button>
              <div
                class="tool-drawer__section-body${sectionId === activeSection ? " is-open" : ""}"
                data-section-body="${sectionId}"
                aria-hidden="${sectionId === activeSection ? "false" : "true"}"
              ></div>
            </section>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

export function createToolDrawer({
  alertPanel,
  formulaPanel,
  settingsPanel,
  initialOpen = false,
  initialSection = "alerts",
  summary = {},
} = {}) {
  const drawer = document.createElement("section");
  drawer.className = "tool-drawer";

  let isOpen = initialOpen;
  let activeSection = initialSection;
  let currentSummary = {
    symbol: summary.symbol ?? "BTCUSDT",
    timeframe: summary.timeframe ?? "1분봉",
    alertCount: summary.alertCount ?? "0건",
  };

  const panelsBySection = new Map([
    ["alerts", alertPanel],
    ["formula", formulaPanel],
    ["settings", settingsPanel],
  ]);

  const mountPanels = () => {
    panelsBySection.forEach((panel, sectionId) => {
      const target = drawer.querySelector(`[data-section-body="${sectionId}"]`);

      if (!target || !panel) {
        return;
      }

      target.replaceChildren(panel);
    });
  };

  const render = () => {
    drawer.innerHTML = getDrawerMarkup({
      isOpen,
      activeSection,
      summary: currentSummary,
    });
    drawer.tabIndex = isOpen ? 0 : -1;
    drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    mountPanels();

    if (isOpen) {
      queueMicrotask(() => {
        drawer.focus();
      });
    }
  };

  drawer.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    if (trigger.dataset.action === "close-drawer") {
      isOpen = false;
      render();
      return;
    }

    if (trigger.dataset.action === "set-section" && trigger.dataset.section) {
      const nextSection = trigger.dataset.section;

      if (nextSection !== activeSection) {
        activeSection = nextSection;
      }

      isOpen = true;
      render();
    }
  });

  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen) {
      return;
    }

    isOpen = false;
    render();
  });

  drawer.setOpen = (nextOpen) => {
    if (Boolean(nextOpen) === isOpen) {
      return false;
    }

    isOpen = Boolean(nextOpen);
    render();
    return true;
  };

  drawer.toggle = () => {
    isOpen = !isOpen;
    render();
    return isOpen;
  };

  drawer.setActiveSection = (nextSection) => {
    if (!panelsBySection.has(nextSection)) {
      return false;
    }

    activeSection = nextSection;
    isOpen = true;
    render();
    return true;
  };

  drawer.setSummary = (nextSummary = {}) => {
    currentSummary = {
      ...currentSummary,
      ...nextSummary,
    };
    render();
    return currentSummary;
  };

  render();

  return drawer;
}
