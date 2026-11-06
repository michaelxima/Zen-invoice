import { isProtectedPath } from "@/lib/auth/protected-paths";

export type ShortcutAction = { kind: "focus-search" } | { kind: "navigate"; href: string };

// The parts of a KeyboardEvent the decision needs; a real KeyboardEvent satisfies this type.
export type ShortcutKeyEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  keyCode?: number;
  target: unknown;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='searchbox'], [role='combobox']";

/** True when the key press belongs to something the user is typing into. */
export function isEditableTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const node = target as { isContentEditable?: unknown; tagName?: unknown; closest?: unknown };
  if (node.isContentEditable === true) return true;
  if (typeof node.tagName === "string" && EDITABLE_TAGS.has(node.tagName.toUpperCase())) return true;
  if (typeof node.closest === "function") {
    return (node.closest as (selector: string) => unknown).call(target, EDITABLE_SELECTOR) != null;
  }
  return false;
}

/**
 * Decides which single-key shortcut, if any, a key press triggers.
 * Shortcuts only run on signed-in app pages (never on the public portal, login or onboarding),
 * never while typing or composing text (IME), and never with Ctrl, Alt or Meta held.
 */
export function resolveShortcut(event: ShortcutKeyEvent, pathname: string): ShortcutAction | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229) return null;
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (!isProtectedPath(pathname) || isEditableTarget(event.target)) return null;

  // Shift is allowed for "/": it needs Shift on many layouts (for example Swedish: Shift+7).
  if (event.key === "/") return { kind: "focus-search" };
  if (event.key === "n" && !event.shiftKey && pathname !== "/invoices/new") {
    return { kind: "navigate", href: "/invoices/new" };
  }
  return null;
}
