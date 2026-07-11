import { describe, expect, it } from "vitest";

import { decideRedirect } from "../lib/supabase/proxy-session";

describe("decideRedirect", () => {
  it("redirects unauthenticated users away from protected dashboard routes", () => {
    expect(decideRedirect(null, "/")).toBe("/login");
    expect(decideRedirect(undefined, "/equipe")).toBe("/login");
  });

  it("allows unauthenticated users to access public routes", () => {
    expect(decideRedirect(null, "/login")).toBeNull();
    expect(decideRedirect(null, "/recuperar-senha")).toBeNull();
    expect(decideRedirect(null, "/nova-senha")).toBeNull();
    expect(decideRedirect(null, "/convite/abc123")).toBeNull();
    expect(decideRedirect(null, "/auth/callback")).toBeNull();
    expect(decideRedirect(null, "/sem-acesso")).toBeNull();
  });

  it("sends advogado users to the no-access page for dashboard routes", () => {
    expect(decideRedirect("advogado", "/")).toBe("/sem-acesso");
    expect(decideRedirect("advogado", "/equipe")).toBe("/sem-acesso");
  });

  it("allows advogado users to stay on the no-access page", () => {
    expect(decideRedirect("advogado", "/sem-acesso")).toBeNull();
  });

  it("allows gestor users on dashboard routes and blocks admin routes", () => {
    expect(decideRedirect("gestor", "/")).toBeNull();
    expect(decideRedirect("gestor", "/equipe")).toBeNull();
    expect(decideRedirect("gestor", "/admin")).toBe("/");
    expect(decideRedirect("gestor", "/admin/usuarios")).toBe("/");
  });

  it("sends super_admin from the root dashboard to the admin interface", () => {
    expect(decideRedirect("super_admin", "/")).toBe("/admin");
  });

  it("allows super_admin users on admin and team routes", () => {
    expect(decideRedirect("super_admin", "/admin")).toBeNull();
    expect(decideRedirect("super_admin", "/equipe")).toBeNull();
  });
});
