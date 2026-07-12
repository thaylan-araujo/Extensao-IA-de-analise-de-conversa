import { describe, expect, it } from "vitest";

describe("ambiente de testes da extensão (happy-dom + setup)", () => {
  it("chrome.storage.local mock faz round-trip set/get", async () => {
    await chrome.storage.local.set({ "sb-session": { token: "abc" } });
    const result = await chrome.storage.local.get("sb-session");
    expect(result["sb-session"]).toEqual({ token: "abc" });
  });

  it("chrome.storage.local.remove apaga a chave", async () => {
    await chrome.storage.local.set({ k: "v" });
    await chrome.storage.local.remove("k");
    const result = await chrome.storage.local.get("k");
    expect(result).toEqual({});
  });

  it("happy-dom fornece um DOM funcional", () => {
    const el = document.createElement("div");
    el.setAttribute("data-id", "false_5511900000000@c.us_ABC123");
    expect(el.getAttribute("data-id")).toContain("@c.us");
  });
});
