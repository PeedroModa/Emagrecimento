import { describe, it, expect, vi } from "vitest";

// useAuth.js importa supabase.js (que lança se as env vars não existirem) e
// os dois hooks de cache — mocka tudo para poder testar as funções puras
// isoladas, sem precisar de rede nem de um projeto Supabase real.
vi.mock("../lib/supabase.js", () => ({ supabase: { auth: {} } }));
vi.mock("./useWeighIns.js", () => ({ clearWeighInsCache: () => {} }));
vi.mock("./useSettings.js", () => ({ clearSettingsCache: () => {} }));

const { mustChangePassword, interpretSignUpResult } = await import("./useAuth.js");

describe("mustChangePassword", () => {
  it("true só quando a flag do user_metadata é exatamente true", () => {
    expect(mustChangePassword({ user_metadata: { must_change_password: true } })).toBe(true);
  });
  it("false quando a flag é false, ausente, ou o usuário é nulo", () => {
    expect(mustChangePassword({ user_metadata: { must_change_password: false } })).toBe(false);
    expect(mustChangePassword({ user_metadata: {} })).toBe(false);
    expect(mustChangePassword({})).toBe(false);
    expect(mustChangePassword(null)).toBe(false);
    expect(mustChangePassword(undefined)).toBe(false);
  });
});

describe("interpretSignUpResult — cadastro self-service", () => {
  it("sessão presente: login imediato, sem confirmação pendente", () => {
    const res = interpretSignUpResult({ session: { access_token: "x" }, user: { identities: [{}] } }, null);
    expect(res).toEqual({ error: null, needsEmailConfirmation: false });
  });

  it("sem sessão mas com usuário e identidade: precisa confirmar e-mail", () => {
    const res = interpretSignUpResult({ session: null, user: { identities: [{ id: "1" }] } }, null);
    expect(res.error).toBeNull();
    expect(res.needsEmailConfirmation).toBe(true);
  });

  it("identities vazio (sem erro): e-mail já cadastrado — anti-enumeração do GoTrue moderno", () => {
    const res = interpretSignUpResult({ session: null, user: { identities: [] } }, null);
    expect(res.error).toMatch(/já tem conta/i);
    expect(res.needsEmailConfirmation).toBe(false);
  });

  it("erro 'already registered' (confirmação de e-mail desligada no projeto)", () => {
    const res = interpretSignUpResult(null, { message: "User already registered", status: 400 });
    expect(res.error).toMatch(/já tem conta/i);
  });

  it("senha curta", () => {
    const res = interpretSignUpResult(null, { message: "Password should be at least 6 characters", status: 422 });
    expect(res.error).toMatch(/senha/i);
  });

  it("rate limit por mensagem ou por status 429", () => {
    expect(interpretSignUpResult(null, { message: "Email rate limit exceeded" }).error).toMatch(/muitas tentativas/i);
    expect(interpretSignUpResult(null, { message: "algo genérico", status: 429 }).error).toMatch(/muitas tentativas/i);
  });

  it("erro desconhecido com status 422: mostra a mensagem da API em vez de engolir", () => {
    const res = interpretSignUpResult(null, { message: "A senha precisa ter maiúscula, minúscula e símbolo", status: 422 });
    expect(res.error).toBe("A senha precisa ter maiúscula, minúscula e símbolo");
  });

  it("erro totalmente inesperado: mensagem genérica, nunca undefined/vazia", () => {
    const res = interpretSignUpResult(null, { message: "algo bizarro", status: 500 });
    expect(res.error).toBeTruthy();
  });

  it("nem data nem error (formato inesperado): não trava, retorna erro genérico", () => {
    const res = interpretSignUpResult(null, null);
    expect(res.error).toBeTruthy();
    expect(res.needsEmailConfirmation).toBe(false);
  });
});
