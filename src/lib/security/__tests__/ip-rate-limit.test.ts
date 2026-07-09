import { describe, it, expect } from "vitest";
import { hashIp, getClientIp } from "@/lib/security/ip-rate-limit.server";

describe("ip-rate-limit helpers", () => {
  it("hashIp devolve string vazia sem IP e determinística para o mesmo IP", () => {
    expect(hashIp("")).toBe("");
    const a = hashIp("203.0.113.9");
    const b = hashIp("203.0.113.9");
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(a).not.toBe(hashIp("203.0.113.10"));
  });

  it("getClientIp prefere cf-connecting-ip e cai para x-forwarded-for", () => {
    const r1 = new Request("http://x", { headers: { "cf-connecting-ip": "198.51.100.5" } });
    expect(getClientIp(r1)).toBe("198.51.100.5");

    const r2 = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.7, 10.0.0.1" } });
    expect(getClientIp(r2)).toBe("198.51.100.7");

    const r3 = new Request("http://x");
    expect(getClientIp(r3)).toBe("");
  });
});
