import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { useAdRotation } from "../../src/features/display/useAdRotation";
import { reconcile } from "../../src/features/display/DisplayProvider";
import PublicDisplay, {
  AdContent,
} from "../../src/features/display/PublicDisplay";
import type { DisplayState, PublicAd } from "../../src/types";
const { mockDisplay } = vi.hoisted(() => ({
  mockDisplay: {
    state: null as DisplayState | null,
    connected: true,
    refresh: vi.fn(),
  },
}));
vi.mock("../../src/features/display/DisplayProvider", async (original) => ({
  ...(await original<
    typeof import("../../src/features/display/DisplayProvider")
  >()),
  useDisplay: () => mockDisplay,
}));
const ad = (id: string, order = 0): PublicAd => ({
  id,
  type: "text",
  heading: id,
  message: "A message",
  image_url: null,
  duration_seconds: 3,
  display_order: order,
});
it("replaces numbers and ads with the closure notice and restores them on resume", () => {
  mockDisplay.state = {
    id: 1,
    current_number: 24,
    revision: 1,
    updated_at: "",
    service_paused: true,
    active_ads: [ad("Notice")],
  };
  const { rerender } = render(<PublicDisplay />);
  expect(
    screen.getByText("මේ දිනවල සෙත් කවි කියන්නේ නොමැති බව කරුණාවෙන් සලකන්න."),
  ).toBeInTheDocument();
  expect(screen.queryByText("024")).toBeNull();
  expect(screen.queryByLabelText("නිවේදනය")).toBeNull();
  mockDisplay.state = {
    ...mockDisplay.state,
    service_paused: false,
    revision: 2,
  };
  rerender(<PublicDisplay />);
  expect(screen.getByText("024")).toBeInTheDocument();
});
const state = (revision: number, ads: PublicAd[] = []): DisplayState => ({
  id: 1,
  current_number: 24,
  revision,
  active_ads: ads,
  updated_at: "",
});
afterEach(() => vi.useRealTimers());
describe("rotation", () => {
  it("orders ads and preserves the timer across number-only updates", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ ads }) => useAdRotation(ads), {
      initialProps: { ads: [ad("b", 1), ad("a", 0)] },
    });
    expect(result.current?.id).toBe("a");
    act(() => vi.advanceTimersByTime(2000));
    rerender({ ads: [ad("b", 1), ad("a", 0)] });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current?.id).toBe("b");
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current?.id).toBe("a");
  });
  it("preserves current ad and handles removal and empty lists", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ ads }) => useAdRotation(ads), {
      initialProps: { ads: [ad("a"), ad("b", 1)] },
    });
    act(() => vi.advanceTimersByTime(3000));
    rerender({ ads: [ad("c"), ad("b", 1)] });
    expect(result.current?.id).toBe("b");
    rerender({ ads: [ad("c")] });
    expect(result.current?.id).toBe("c");
    rerender({ ads: [] });
    expect(result.current).toBeNull();
  });
  it("cleans timers on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useAdRotation([ad("a"), ad("b", 1)]));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
describe("public state", () => {
  it("ignores stale and equal revisions", () => {
    const current = state(3);
    expect(reconcile(current, state(2))).toBe(current);
    expect(reconcile(current, state(3))).toBe(current);
    expect(reconcile(current, state(4)).revision).toBe(4);
  });
  it("renders advertisements after the number without controls", () => {
    mockDisplay.state = state(1, [ad("Welcome")]);
    render(<PublicDisplay />);
    const number = screen.getByText("024");
    const heading = screen.getByText("Welcome");
    expect(
      number.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector(".public-display")).toHaveClass("has-ad");
  });
  it("removes the lower section when no ads exist", () => {
    mockDisplay.state = state(2);
    render(<PublicDisplay />);
    expect(screen.queryByLabelText("නිවේදනය")).toBeNull();
    expect(document.querySelector(".public-display")).not.toHaveClass("has-ad");
  });
  it("renders a recovery screen before first data", () => {
    mockDisplay.state = null;
    mockDisplay.connected = false;
    render(<PublicDisplay />);
    expect(screen.getByText(/සම්බන්ධ වෙමින්/)).toBeInTheDocument();
    expect(screen.queryByText("000")).toBeNull();
  });
  it("renders an image and plain text safely", () => {
    render(
      <AdContent
        ad={{
          ...ad("x"),
          type: "image",
          image_url: "https://example.test/ad.png",
        }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.test/ad.png",
    );
  });
});
