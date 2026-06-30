/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { isSkeletonEffect } from "../types";
import { findScreen } from "../registry";

// --- Mock supabase client used inside SkeletonRenderer ---
const selectMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: (...args: unknown[]) => selectMock(...args) }),
  },
}));

import { SkeletonRenderer, clearSkeletonCache } from "../SkeletonRenderer";

beforeEach(() => {
  clearSkeletonCache();
  selectMock.mockReset();
});

describe("isSkeletonEffect", () => {
  it("aceita efeitos conhecidos", () => {
    for (const v of ["shimmer", "gradient", "pulse", "outline"]) {
      expect(isSkeletonEffect(v)).toBe(true);
    }
  });
  it("rejeita valores inválidos / nulos / não-string", () => {
    expect(isSkeletonEffect("foo")).toBe(false);
    expect(isSkeletonEffect("")).toBe(false);
    expect(isSkeletonEffect(null)).toBe(false);
    expect(isSkeletonEffect(undefined)).toBe(false);
    expect(isSkeletonEffect(42)).toBe(false);
  });
});

describe("findScreen", () => {
  it("retorna entrada quando key existe", () => {
    expect(findScreen("dashboard")?.defaultEffect).toBeDefined();
  });
  it("retorna undefined para key inexistente", () => {
    expect(findScreen("not-a-real-screen")).toBeUndefined();
  });
});

describe("SkeletonRenderer", () => {
  it("renderiza children quando isLoading=false", () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    render(
      <SkeletonRenderer screenKey="dashboard" isLoading={false}>
        <p>conteúdo</p>
      </SkeletonRenderer>,
    );
    expect(screen.getByText("conteúdo")).toBeTruthy();
  });

  it("renderiza skeleton com role=status quando isLoading=true", () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    render(<SkeletonRenderer screenKey="dashboard" isLoading={true} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("não quebra quando supabase retorna erro (fallback ao default da tela)", async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(<SkeletonRenderer screenKey="dashboard" isLoading={true} />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("ignora linhas com effect_type inválido vindas do banco", async () => {
    selectMock.mockResolvedValue({
      data: [
        { screen_key: "dashboard", effect_type: "lixo-invalido", is_active: true },
      ],
      error: null,
    });
    render(<SkeletonRenderer screenKey="dashboard" isLoading={true} />);
    await waitFor(() => expect(selectMock).toHaveBeenCalled());
    // Still renders without throwing → fallback to default ("layered")
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("usa fallbackVariant quando screenKey é desconhecido", () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    render(
      <SkeletonRenderer
        screenKey="screen-inexistente"
        isLoading={true}
        fallbackVariant="pulse"
      />,
    );
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
