import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppointmentPage from "../../src/features/appointments/AppointmentPage";
import AdvertisementsPage from "../../src/features/advertisements/AdvertisementsPage";
import { AdForm } from "../../src/features/advertisements/AdForm";
import AdminLayout from "../../src/layouts/AdminLayout";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({}),
  listAds: vi.fn().mockResolvedValue([]),
  refresh: vi.fn(),
  connected: true,
  auth: { ready: true, admin: true, session: {}, recheck: vi.fn() },
}));
vi.mock("../../src/lib/api", () => ({
  rpc: mocks.rpc,
  listAds: mocks.listAds,
  cleanupImage: vi.fn(),
  saveAd: vi.fn(),
}));
vi.mock("../../src/features/display/DisplayProvider", () => ({
  useDisplay: () => ({
    state: { current_number: 24, revision: 1, service_paused: false },
    connected: mocks.connected,
    refresh: mocks.refresh,
  }),
}));
vi.mock("../../src/features/auth/AuthProvider", () => ({
  useAuth: () => mocks.auth,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.connected = true;
});
describe("appointment controls", () => {
  it("saves the closure switch through the authorized RPC", async () => {
    render(<AppointmentPage />);
    fireEvent.click(
      screen.getByRole("switch", { name: "සේවාව නොපැවැත්වෙන බවට පිටුව පෙන්වන්න" }),
    );
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("set_service_paused", {
        p_paused: true,
      }),
    );
  });
  it("increments via RPC, never frontend arithmetic", async () => {
    render(<AppointmentPage />);
    fireEvent.click(screen.getByRole("button", { name: "ඊළඟ බැතිමතා" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "increment_appointment",
        undefined,
      ),
    );
  });
  it("validates and sets a number", async () => {
    render(<AppointmentPage />);
    fireEvent.change(screen.getByLabelText("සෙත් කවි කියවීමේ අංකය ඇතුළත් කරන්න"), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "අංකය සකසන්න" }));
    expect(
      await screen.findByText("0 සිට 9999 දක්වා පූර්ණ සංඛ්‍යාවක් ඇතුළත් කරන්න."),
    ).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("සෙත් කවි කියවීමේ අංකය ඇතුළත් කරන්න"), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "අංකය සකසන්න" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("set_appointment_number", {
        p_number: 42,
      }),
    );
  });
  it("confirms resets and has no advertisement management", async () => {
    render(<AppointmentPage />);
    fireEvent.click(screen.getByRole("button", { name: "අංකය මුලට සකසන්න" }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "000 ලෙස සකසන්න" }));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        "reset_appointment_number",
        undefined,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "නිවේදනයක් එක් කරන්න" }),
    ).toBeNull();
  });
  it("disables mutations offline", () => {
    mocks.connected = false;
    render(<AppointmentPage />);
    expect(screen.getByRole("button", { name: "ඊළඟ බැතිමතා" })).toBeDisabled();
  });
});
describe("advertisements and navigation", () => {
  it("shows empty state and excludes appointment controls", async () => {
    render(<AdvertisementsPage />);
    expect(await screen.findByText("තවම නිවේදන නොමැත.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ඊළඟ බැතිමතා" })).toBeNull();
  });
  it("provides type-specific fields and preview", () => {
    render(<AdForm connected onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByLabelText("නිවේදන මාතෘකාව")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("නිවේදන වර්ගය"), {
      target: { value: "image" },
    });
    expect(screen.getByLabelText("නිවේදන රූපය")).toBeInTheDocument();
    expect(screen.queryByLabelText("නිවේදන මාතෘකාව")).toBeNull();
  });
  it("uses separate real routes", () => {
    render(
      <MemoryRouter initialEntries={["/admin/appointments"]}>
        <AdminLayout />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "සෙත් කවි කියවීමේ අංක පාලනය" }),
    ).toHaveAttribute("href", "/admin/appointments");
    expect(screen.getByRole("link", { name: "නිවේදන" })).toHaveAttribute(
      "href",
      "/admin/advertisements",
    );
  });
});
