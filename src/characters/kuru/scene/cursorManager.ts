let _cursorOwner: string | null = null;

export function setCursor(owner: string, hover: boolean) {
  if (hover) {
    _cursorOwner = owner;
    document.body.style.cursor = "pointer";
  } else if (_cursorOwner === owner) {
    _cursorOwner = null;
    document.body.style.cursor = "";
  }
}
