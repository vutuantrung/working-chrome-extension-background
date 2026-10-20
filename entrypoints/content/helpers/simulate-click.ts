export const simulateHumanClick = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect();

  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const eventOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
  };

  el.dispatchEvent(new PointerEvent("pointerover", eventOptions));
  el.dispatchEvent(new MouseEvent("mouseover", eventOptions));

  el.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
  el.dispatchEvent(new MouseEvent("mousedown", eventOptions));

  el.dispatchEvent(new PointerEvent("pointerup", eventOptions));
  el.dispatchEvent(new MouseEvent("mouseup", eventOptions));

  el.dispatchEvent(new MouseEvent("click", eventOptions));
};
