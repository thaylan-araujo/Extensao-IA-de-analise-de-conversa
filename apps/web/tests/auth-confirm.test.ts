import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      verifyOtp,
      exchangeCodeForSession
    }
  }))
}));

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    exchangeCodeForSession.mockReset();
  });

  it("verifies a recovery token and redirects to the internal next path", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=valid-hash&type=recovery&next=/nova-senha"
      )
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-hash",
      type: "recovery"
    });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBe("http://localhost:3000/nova-senha");
  });

  it("redirects to recuperar-senha with an error when verifyOtp fails", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=expired-hash&type=recovery&next=/nova-senha"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/recuperar-senha?erro=link-invalido"
    );
  });

  it("ignores an external next URL and redirects to the internal default", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/confirm?token_hash=valid-hash&type=recovery&next=https://evil.example"
      )
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/nova-senha");
  });

  it("redirects with an error without calling verifyOtp when params are missing", async () => {
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(new Request("http://localhost:3000/auth/confirm"));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/recuperar-senha?erro=link-invalido"
    );
  });

  it("exchanges a PKCE code (default Supabase template) and redirects to next", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(
      new Request("http://localhost:3000/auth/confirm?next=/nova-senha&code=pkce-code-123")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-123");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/nova-senha");
  });

  it("redirects to recuperar-senha with an error when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const { GET } = await import("../app/auth/confirm/route");
    const response = await GET(
      new Request("http://localhost:3000/auth/confirm?next=/nova-senha&code=expired-code")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/recuperar-senha?erro=link-invalido"
    );
  });
});
