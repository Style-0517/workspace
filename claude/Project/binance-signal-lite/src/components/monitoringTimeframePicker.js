import {
  getMonitoringTimeframeLabel,
  getMonitoringTimeframeOptions,
  normalizeMonitoringTimeframe,
} from "../config/monitoringTimeframes.js";

function renderTimeframeOption(option, activeTimeframe) {
  const isActive = option.value === activeTimeframe;

  return `
    <button
      class="monitoring-timeframe-picker__option${isActive ? " is-active" : ""}"
      type="button"
      data-timeframe="${option.value}"
      aria-pressed="${isActive}"
    >
      <strong>${option.value}</strong>
      <span>${option.label}</span>
    </button>
  `;
}

export function getMonitoringTimeframePickerMarkup({
  activeTimeframe,
  isOpen = false,
} = {}) {
  const resolvedTimeframe = normalizeMonitoringTimeframe(activeTimeframe);

  return `
    <div class="monitoring-timeframe-picker__dock">
      <div class="monitoring-timeframe-picker__control">
        <button
          class="monitoring-timeframe-picker__trigger${isOpen ? " is-open" : ""}"
          type="button"
          data-action="toggle-menu"
          aria-expanded="${isOpen}"
          aria-haspopup="listbox"
        >
          <span class="monitoring-timeframe-picker__trigger-value">${resolvedTimeframe}</span>
          <span class="monitoring-timeframe-picker__trigger-hint">시간봉</span>
          <span class="monitoring-timeframe-picker__caret" aria-hidden="true"></span>
        </button>
        <div
          class="monitoring-timeframe-picker__menu${isOpen ? " is-open" : ""}"
          role="listbox"
          aria-label="감시 시간봉 선택"
          aria-hidden="${isOpen ? "false" : "true"}"
        >
          ${getMonitoringTimeframeOptions()
            .map((option) => renderTimeframeOption(option, resolvedTimeframe))
            .join("")}
        </div>
      </div>
    </div>
  `;
}

export function createMonitoringTimeframePicker({
  activeTimeframe,
  onSelect = null,
} = {}) {
  const picker = document.createElement("section");
  picker.className = "monitoring-timeframe-picker";

  let resolvedTimeframe = normalizeMonitoringTimeframe(activeTimeframe);
  let isOpen = false;

  const render = () => {
    picker.innerHTML = getMonitoringTimeframePickerMarkup({
      activeTimeframe: resolvedTimeframe,
      isOpen,
    });
  };

  picker.addEventListener("click", (event) => {
    const menuTrigger = event.target.closest('[data-action="toggle-menu"]');

    if (menuTrigger instanceof HTMLElement) {
      isOpen = !isOpen;
      render();
      return;
    }

    const trigger = event.target.closest("[data-timeframe]");

    if (!trigger || !(trigger instanceof HTMLElement)) {
      return;
    }

    const nextTimeframe = normalizeMonitoringTimeframe(trigger.dataset.timeframe);

    if (nextTimeframe === resolvedTimeframe) {
      isOpen = false;
      render();
      return;
    }

    resolvedTimeframe = nextTimeframe;
    isOpen = false;
    render();
    onSelect?.(resolvedTimeframe);
  });

  picker.addEventListener("focusout", (event) => {
    const nextFocusedTarget = event.relatedTarget;

    if (nextFocusedTarget instanceof Node && picker.contains(nextFocusedTarget)) {
      return;
    }

    if (!isOpen) {
      return;
    }

    isOpen = false;
    render();
  });

  picker.setActiveTimeframe = (nextTimeframe) => {
    const normalizedTimeframe = normalizeMonitoringTimeframe(nextTimeframe);

    if (normalizedTimeframe === resolvedTimeframe) {
      return false;
    }

    resolvedTimeframe = normalizedTimeframe;
    isOpen = false;
    render();
    return true;
  };

  picker.getActiveTimeframe = () => resolvedTimeframe;

  render();

  return picker;
}
