/**
 * Tests for the "neue Schule anlegen" flow inside the Auth registration form.
 *
 * Covered scenarios:
 *  1. Successful school creation → school added to dropdown and auto-selected
 *  2. Automatic selection of the new school in the <select>
 *  3. Submit button disabled while school request is in flight
 *  4. Real API error → error toast shown, state NOT updated
 *  5. Graceful infra error (PGRST205) → school still added locally
 *  6. Double-tap / rapid tapping → only one API call fires
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth";

// ──────────────────────────────────────────────────────────────────────────────
// Hoisted mocks (vi.mock is hoisted to top of file, so shared refs must be too)
// ──────────────────────────────────────────────────────────────────────────────

const { mockRpc, mockToast, mockNavigate } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  mockNavigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: "" }),
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/lib/roles", () => ({
  getCurrentAppRole: vi.fn().mockResolvedValue("student"),
  routeForRole: (_role: string) => "/dashboard",
}));
vi.mock("@/lib/demo", () => ({ DEMO_MIN_POINTS: 100 }));
vi.mock("@/services/codeAuthService", () => ({ activateQrAsSupabaseUser: vi.fn() }));
vi.mock("jsqr", () => ({ default: vi.fn() }));
vi.mock("@/assets/boost-logo.png", () => ({ default: "" }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    },
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Renders Auth and navigates to the signup tab. */
async function renderSignupView() {
  const user = userEvent.setup();
  render(<Auth />);

  // Wait for the initial school load (rpc called with get_registered_schools)
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith("get_registered_schools"));

  // Switch to signup tab
  const registerLink = await screen.findByRole("button", { name: /Neu hier\? Jetzt registrieren/i });
  await user.click(registerLink);

  // The "Schule nicht dabei" toggle must be visible
  await screen.findByRole("button", { name: /Schule nicht dabei/i });

  return user;
}

/** Expands the "neue Schule" input panel. */
async function openNewSchoolPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Schule nicht dabei/i }));
  await screen.findByPlaceholderText(/Name deiner Schule/i);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test setup
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();

  // Default: get_registered_schools returns an empty list
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === "get_registered_schools") {
      return Promise.resolve({ data: [], error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("Neue Schule anlegen im Registrierungsflow", () => {
  it("1 – erfolgreiche Schul-Erstellung: Schule erscheint im Dropdown und wird ausgewählt", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") return Promise.resolve({ data: "uuid-1", error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "Neue Gesamtschule Nord");
    await user.click(screen.getByRole("button", { name: /Schule hinzufügen/i }));

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Neue Gesamtschule Nord");
    });
    expect(mockToast.success).toHaveBeenCalledWith("Schule hinzugefügt und ausgewählt.");
    expect(mockRpc).toHaveBeenCalledWith(
      "submit_school_registration_request",
      expect.objectContaining({ p_requested_school: "Neue Gesamtschule Nord" })
    );
  });

  it("2 – automatische Auswahl: <select> zeigt die neue Schule nach dem Speichern", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") return Promise.resolve({ data: "uuid-2", error: null });
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "Mustergymnasium");
    await user.click(screen.getByRole("button", { name: /Schule hinzufügen/i }));

    await waitFor(() => {
      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("Mustergymnasium");
    });
  });

  it("3 – Registrieren-Button ist deaktiviert solange die Schule gespeichert wird", async () => {
    let resolveSchoolRequest!: (value: { data: string; error: null }) => void;
    const hangingPromise = new Promise<{ data: string; error: null }>((res) => {
      resolveSchoolRequest = res;
    });

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") return hangingPromise;
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "Warteschule");

    // Start the school request but don't await — the promise hangs
    void user.click(screen.getByRole("button", { name: /Schule hinzufügen/i }));

    // While the request is pending the submit button must be disabled
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /Registrieren/i });
      expect(submitBtn).toBeDisabled();
    });

    // Resolve so the component can unmount cleanly
    resolveSchoolRequest({ data: "uuid-done", error: null });
  });

  it("4 – fehlgeschlagene Schul-Erstellung: Fehler-Toast wird angezeigt, Dropdown bleibt leer", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") {
        return Promise.resolve({
          data: null,
          error: { message: "Unique constraint violation", code: "23505" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "Schule mit Fehler");
    await user.click(screen.getByRole("button", { name: /Schule hinzufügen/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Unique constraint violation")
      );
    });

    // School must NOT be added to the dropdown on a real API error
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("5 – Infra-Fehler (PGRST205): Schule wird lokal übernommen, Toast zeigt Hinweis", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") {
        return Promise.resolve({
          data: null,
          error: { message: "could not find the function", code: "PGRST205" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "Schule ohne RPC");
    await user.click(screen.getByRole("button", { name: /Schule hinzufügen/i }));

    // Even with an infra error the school should be selected locally
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("Schule ohne RPC");
    });
    expect(mockToast.success).toHaveBeenCalledWith(
      expect.stringContaining("Anfrage wird manuell geprüft")
    );
  });

  it("6 – Mehrfachklick auf Android: nur ein API-Call wird abgesetzt", async () => {
    let callCount = 0;
    let resolveFirst!: (value: { data: string; error: null }) => void;
    const firstCallPromise = new Promise<{ data: string; error: null }>((res) => {
      resolveFirst = res;
    });

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_registered_schools") return Promise.resolve({ data: [], error: null });
      if (fnName === "submit_school_registration_request") {
        callCount++;
        return firstCallPromise;
      }
      return Promise.resolve({ data: null, error: null });
    });

    const user = await renderSignupView();
    await openNewSchoolPanel(user);

    await user.type(screen.getByPlaceholderText(/Name deiner Schule/i), "DoubleTap Schule");

    const addButton = screen.getByRole("button", { name: /Schule hinzufügen/i });

    // Simulate two rapid taps (Android double-tap)
    void user.click(addButton);
    void user.click(addButton);

    // Wait for the first call to be registered
    await waitFor(() => expect(callCount).toBeGreaterThan(0));

    // Resolve the first (and only) request
    resolveFirst({ data: "uuid-single", error: null });

    // Despite two taps only one API call must have fired
    await waitFor(() => {
      expect(callCount).toBe(1);
    });
  });
});
