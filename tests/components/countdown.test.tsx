import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Countdown } from "@/components/app/staff/countdown";

const START = new Date("2026-10-19T12:00:00Z").getTime();
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Countdown", () => {
  it("counts down from 1:30 to 0:00 and fires onExpire once", () => {
    const onExpire = vi.fn();
    render(<Countdown expiresAt={new Date(START + 90_000).toISOString()} onExpire={onExpire} />);
    expect(screen.getByRole("timer")).toHaveTextContent("1:30");
    advance(30_000);
    expect(screen.getByRole("timer")).toHaveTextContent("1:00");
    advance(59_000);
    expect(screen.getByRole("timer")).toHaveTextContent("0:01");
    advance(1_000);
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    expect(onExpire).toHaveBeenCalledTimes(1);
    advance(10_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("announces only at 60, 30, 10 seconds and expiry", () => {
    render(<Countdown expiresAt={new Date(START + 90_000).toISOString()} />);
    const live = () => screen.getByTestId("countdown-announcement");
    expect(live()).toHaveTextContent("");
    advance(29_000);
    expect(live()).toHaveTextContent("");
    advance(1_000);
    expect(live()).toHaveTextContent("1 minute left");
    advance(15_000);
    expect(live()).toHaveTextContent("1 minute left");
    advance(15_000);
    expect(live()).toHaveTextContent("30 seconds left");
    advance(20_000);
    expect(live()).toHaveTextContent("10 seconds left");
    advance(10_000);
    expect(live()).toHaveTextContent("Code expired");
  });
});
