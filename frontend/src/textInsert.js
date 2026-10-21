// Inserts a snippet at wherever the caret currently sits in a textarea
// (rather than just appending to the end), then restores focus and moves the
// caret to just after what was inserted — used by the image-upload button so
// dropping in a picture doesn't disturb whatever the admin was typing.
export function insertAtCursor(ref, value, setValue, snippet) {
  const el = ref.current;
  if (!el) { setValue(value + snippet); return; }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + snippet + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + snippet.length;
    el.setSelectionRange(pos, pos);
  });
}
