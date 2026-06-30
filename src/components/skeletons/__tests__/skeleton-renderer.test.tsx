/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { isSkeletonEffect, SKELETON_EFFECT_VALUES } from "../types";
import { findScreen, screenRegistry } from "../registry";
import { EFFECT_COMPONENTS } from "../effects";

const selectMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: (...a: unknown[]) => selectMock(...a) }) },
}));

import { SkeletonRenderer, clearSkeletonCache } from "../SkeletonRenderer";

beforeEach(() => {
  clearSkeletonCache();
  selectMock.mockReset();
  selectMock.mockResolvedValue({ data: [], error: null });
});

describe("isSkeletonEffect", () => {
  it("aceita os 9 efeitos registrados", () => {
    expect(SKELETON_EFFECT_VALUES).toHaveLength(9);
    for (const v of SKELETON_EFFECT_VALUES) expect(isSkeletonEffect(v)).toBe(true);
  });
  it("rejeita valores inválidos / nulos / não-string", () => {
    for (const v of ["foo", "", null, undefined, 42, {}, []]) {
      expect(isSkeletonEffect(v as unknown)).toBe(false);
    }
  });
});

describe("registry", () => {
  it("toda entrada tem defaultEffect válido", () => {
    for (const s of screenRegistry) expect(isSkeletonEffect(s.defaultEffect)).toBe(true);
  });
  it("findScreen retorna undefined para key desconhecida", () => {
    expect(findScreen("nope")).toBeUndefined();
  });
});

describe("EFFECT_COMPONENTS", () => {
  it("contém um componente para cada efeito", () => {
    for (const v of SKELETON_EFFECT_VALUES) {
      expect(EFFECT_COMPONENTS[v]).toBeTypeOf("function");
    }
  });
});

describe("SkeletonRenderer (SSR)", () => {
  it("renderiza children quando isLoading=false", () => {
    const html = renderToString(
      <SkeletonRenderer screenKey="dashboard" isLoading={false}>
        <p>conteúdo</p>
      </SkeletonRenderer>,
    );
    expect(html).toContain("conteúdo");
    expect(html).not.toContain('role="status"');
  });

  it("renderiza wrapper com role=status quando isLoading=true", () => {
    const html = renderToString(
      <SkeletonRenderer screenKey="dashboard" isLoading={true} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it("usa fallbackVariant quando screenKey é desconhecido — não lança", () => {
    const html = renderToString(
      <SkeletonRenderer
        screenKey="screen-inexistente"
        isLoading={true}
        fallbackVariant="pulse"
      />,
    );
    expect(html).toContain('role="status"');
  });
});
