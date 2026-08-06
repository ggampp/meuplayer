/**
 * DPAD / arrow spatial navigation for TV shells and remote.
 */
const FOCUSABLE_SELECTOR =
  ".focusable, button, a, select, input, textarea, [tabindex]";

type Direction = "up" | "down" | "left" | "right";

function getCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getFocusableElements(): HTMLElement[] {
  const list = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR));
  return list.filter((el): el is HTMLElement => {
    const htmlEl = el as HTMLElement & { disabled?: boolean };
    if (htmlEl.disabled) return false;
    if (el.getAttribute("tabindex") === "-1") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
}

function navigate(direction: Direction): void {
  const active = document.activeElement as HTMLElement | null;
  const candidates = getFocusableElements();
  if (candidates.length === 0) return;

  if (!active || active === document.body || !candidates.includes(active)) {
    candidates[0].focus();
    return;
  }

  const currentRect = active.getBoundingClientRect();
  const currentCenter = getCenter(currentRect);

  let bestCandidate: HTMLElement | null = null;
  let bestDistance = Infinity;

  candidates.forEach((candidate) => {
    if (candidate === active) return;
    const rect = candidate.getBoundingClientRect();
    const center = getCenter(rect);

    let isValid = false;
    if (direction === "left") isValid = center.x < currentCenter.x - 10;
    if (direction === "right") isValid = center.x > currentCenter.x + 10;
    if (direction === "up") isValid = center.y < currentCenter.y - 10;
    if (direction === "down") isValid = center.y > currentCenter.y + 10;
    if (!isValid) return;

    let distance = 0;
    if (direction === "left" || direction === "right") {
      distance =
        Math.abs(center.x - currentCenter.x) +
        Math.abs(center.y - currentCenter.y) * 2;
    } else {
      distance =
        Math.abs(center.y - currentCenter.y) +
        Math.abs(center.x - currentCenter.x) * 2;
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  });

  if (bestCandidate) bestCandidate.focus();
}

function isTextInput(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type || "text";
    return !["button", "submit", "checkbox", "radio", "reset", "file"].includes(
      type
    );
  }
  return el.isContentEditable;
}

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (isTextInput(event.target)) return;

  const keyMap: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  const direction = keyMap[event.key];
  if (direction) {
    event.preventDefault();
    navigate(direction);
    return;
  }

  if (event.key === "Enter") {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && typeof active.click === "function") {
      // avoid double-submit on buttons that already receive Enter
      if (active.tagName === "BUTTON" || active.tagName === "A") return;
      event.preventDefault();
      active.click();
    }
  }
});

// Initial focus for TV
window.addEventListener("load", () => {
  const candidates = getFocusableElements();
  if (candidates.length && document.activeElement === document.body) {
    candidates[0].focus();
  }
});
