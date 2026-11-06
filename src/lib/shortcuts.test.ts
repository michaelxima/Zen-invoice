import { describe, expect, it } from "vitest";
import { isEditableTarget, resolveShortcut, type ShortcutKeyEvent } from "./shortcuts";

const body = { tagName: "BODY", isContentEditable: false, closest: () => null };
const press = (key: string, overrides: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  target: body,
  ...overrides,
});

describe("isEditableTarget", () => {
  it.each(["INPUT", "TEXTAREA", "SELECT", "input", "textarea"])("treats <%s> as editable", (tagName) => {
    expect(isEditableTarget({ tagName })).toBe(true);
  });

  it("treats contenteditable elements as editable", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("treats children of editable or textbox-role elements as editable", () => {
    const insideEditor = { tagName: "SPAN", isContentEditable: false, closest: () => ({ tagName: "DIV" }) };
    expect(isEditableTarget(insideEditor)).toBe(true);
  });

  it("does not treat ordinary elements, null or non-objects as editable", () => {
    expect(isEditableTarget(body)).toBe(false);
    expect(isEditableTarget({ tagName: "BUTTON", closest: () => null })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget("input")).toBe(false);
  });
});

describe("resolveShortcut", () => {
  it("opens a new invoice on n from a signed-in page", () => {
    expect(resolveShortcut(press("n"), "/dashboard")).toEqual({ kind: "navigate", href: "/invoices/new" });
  });

  it("does nothing on n when already on the new invoice page", () => {
    expect(resolveShortcut(press("n"), "/invoices/new")).toBeNull();
  });

  it("focuses search on /, with or without Shift (Shift+7 on Nordic layouts)", () => {
    expect(resolveShortcut(press("/"), "/invoices")).toEqual({ kind: "focus-search" });
    expect(resolveShortcut(press("/", { shiftKey: true }), "/invoices")).toEqual({ kind: "focus-search" });
  });

  it.each([
    ["typing in an input", press("n", { target: { tagName: "INPUT" } })],
    ["typing in a textarea", press("n", { target: { tagName: "TEXTAREA" } })],
    ["typing in a select", press("/", { target: { tagName: "SELECT" } })],
    ["typing in contenteditable", press("/", { target: { tagName: "DIV", isContentEditable: true } })],
    ["IME composition", press("n", { isComposing: true })],
    ["IME process key (keyCode 229)", press("n", { keyCode: 229 })],
    ["Ctrl held", press("n", { ctrlKey: true })],
    ["Cmd held", press("n", { metaKey: true })],
    ["Alt held (AltGr+7 is / on some layouts)", press("/", { altKey: true })],
    ["Shift+N", press("N", { shiftKey: true })],
    ["a held-down key repeating", press("n", { repeat: true })],
    ["an event another handler already handled", press("n", { defaultPrevented: true })],
    ["an unrelated key", press("x")],
  ])("ignores %s", (_label, event) => {
    expect(resolveShortcut(event, "/dashboard")).toBeNull();
  });

  it.each(["/login", "/onboarding", "/portal/abc", "/"])("never fires on the public page %s", (pathname) => {
    expect(resolveShortcut(press("n"), pathname)).toBeNull();
    expect(resolveShortcut(press("/"), pathname)).toBeNull();
  });

  it("no longer handles Ctrl/Cmd+K (the command palette placeholder was removed)", () => {
    expect(resolveShortcut(press("k", { ctrlKey: true }), "/dashboard")).toBeNull();
    expect(resolveShortcut(press("k", { metaKey: true }), "/dashboard")).toBeNull();
  });
});
