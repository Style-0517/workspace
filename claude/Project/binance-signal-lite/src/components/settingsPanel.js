function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getSettingsPanelMarkup({
  isDarkMode = false,
} = {}) {
  return `
    <div class="settings-panel__header">
      <div>
        <p class="settings-panel__eyebrow">설정</p>
        <h2>화면 설정</h2>
      </div>
      <span class="settings-panel__badge">${isDarkMode ? "다크" : "라이트"}</span>
    </div>
    <div class="settings-panel__item">
      <div>
        <strong>다크모드</strong>
        <p>빗썸형 레이아웃을 유지한 채 어두운 배경 테마로 전환합니다.</p>
      </div>
      <button
        type="button"
        class="settings-panel__toggle${isDarkMode ? " is-active" : ""}"
        data-action="toggle-dark-mode"
        aria-pressed="${isDarkMode}"
      >
        <span>${escapeHtml(isDarkMode ? "ON" : "OFF")}</span>
      </button>
    </div>
  `;
}

export function createSettingsPanel({
  isDarkMode = false,
  onToggleDarkMode = null,
} = {}) {
  const panel = document.createElement("section");
  panel.className = "settings-panel";

  let darkModeEnabled = Boolean(isDarkMode);

  const render = () => {
    panel.innerHTML = getSettingsPanelMarkup({
      isDarkMode: darkModeEnabled,
    });
  };

  panel.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action='toggle-dark-mode']");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    darkModeEnabled = !darkModeEnabled;
    render();
    onToggleDarkMode?.(darkModeEnabled);
  });

  panel.setDarkMode = (nextValue) => {
    const nextState = Boolean(nextValue);

    if (nextState === darkModeEnabled) {
      return false;
    }

    darkModeEnabled = nextState;
    render();
    return true;
  };

  render();

  return panel;
}
