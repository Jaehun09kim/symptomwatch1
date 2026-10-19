import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoopDemo } from "@/components/marketing/loop-demo";
import { SiteHeader } from "@/components/marketing/site-header";
import { MotionProvider } from "@/components/motion/motion-provider";

const preferences = vi.hoisted(() => ({ reduce: false, inView: false }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("framer-motion", async (original) => ({
  ...await original<typeof import("framer-motion")>(),
  useReducedMotion: () => preferences.reduce,
  useInView: () => preferences.inView,
}));

const example = () => <MotionProvider><LoopDemo patient="Rachel Kim" mrn="DEMO-00019" /></MotionProvider>;
const status = () => screen.getByRole("figure").querySelector('[aria-live="off"] > span:first-child');
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  preferences.reduce = false;
  preferences.inView = false;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("marketing interactions", () => {
  it("waits for the example to enter view, supports pause, and finishes without restarting", () => {
    const view = render(example());
    advance(10_000);
    expect(status()).toHaveTextContent("Awaiting review");

    preferences.inView = true;
    view.rerender(example());
    fireEvent.click(screen.getByRole("button", { name: "Pause example" }));
    advance(10_000);
    expect(status()).toHaveTextContent("Awaiting review");
    fireEvent.click(screen.getByRole("button", { name: "Play example" }));
    advance(2400);
    expect(status()).toHaveTextContent("Gap confirmed");
    advance(2200);
    expect(status()).toHaveTextContent("Task in progress");
    advance(2200);
    expect(screen.getByText("Vitamin D result filed")).toBeInTheDocument();
    advance(20_000);
    expect(status()).toHaveTextContent("Resolved by new data");

    fireEvent.click(screen.getByRole("button", { name: "Replay example" }));
    expect(status()).toHaveTextContent("Awaiting review");
  });

  it("shows the completed example under reduced motion, even before it enters view", () => {
    preferences.reduce = true;
    render(example());
    advance(1);
    expect(screen.getByText("Vitamin D result filed")).toBeInTheDocument();
    advance(20_000);
    expect(status()).toHaveTextContent("Resolved by new data");
  });

  it("keeps initial markup identical regardless of the reduced-motion preference", () => {
    const serverMarkup = renderToString(example());
    preferences.reduce = true;
    expect(renderToString(example())).toBe(serverMarkup);
  });

  it("settles a paused example when the reduced-motion preference changes", () => {
    preferences.inView = true;
    const view = render(example());
    fireEvent.click(screen.getByRole("button", { name: "Pause example" }));
    preferences.reduce = true;
    view.rerender(example());
    advance(1);
    expect(screen.getByText("Vitamin D result filed")).toBeInTheDocument();
  });

  it("opens navigation with ArrowDown and restores trigger focus on Escape", () => {
    render(<MotionProvider><SiteHeader /></MotionProvider>);
    const nav = within(screen.getByRole("navigation", { name: "Primary" }));
    const product = nav.getByRole("button", { name: /^Product/ });
    fireEvent.keyDown(product, { key: "ArrowDown" });
    advance(32);
    expect(nav.getByRole("link", { name: /Explainable flags/ })).toHaveFocus();
    expect(product).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(product).toHaveFocus();
    expect(product).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the dropdown when keyboard focus leaves navigation", () => {
    render(<MotionProvider><SiteHeader /></MotionProvider>);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const product = within(nav).getByRole("button", { name: /^Product/ });
    fireEvent.click(product);
    expect(product).toHaveAttribute("aria-expanded", "true");
    fireEvent.blur(nav, { relatedTarget: screen.getByRole("link", { name: "Sign in" }) });
    expect(product).toHaveAttribute("aria-expanded", "false");
  });
});
