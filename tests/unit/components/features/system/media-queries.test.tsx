import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MediaQueries } from "@/components/features/system/media-queries";

describe("MediaQueries", () => {
  it("renders Breakpoints and Accessibility subsections", () => {
    render(<MediaQueries />);
    expect(
      screen.getByRole("heading", { name: "Breakpoints" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Accessibility" }),
    ).toBeInTheDocument();
  });

  it("renders both breakpoint tokens", () => {
    render(<MediaQueries />);
    expect(screen.getByText("--tablet")).toBeInTheDocument();
    expect(screen.getByText("--desktop")).toBeInTheDocument();
  });

  it("renders the accessibility token", () => {
    render(<MediaQueries />);
    expect(screen.getByText("--reduced-motion")).toBeInTheDocument();
  });

  it("renders each token's resolved (mobile-first min-width) expression", () => {
    render(<MediaQueries />);
    expect(screen.getByText("(min-width: 720px)")).toBeInTheDocument();
    expect(screen.getByText("(min-width: 900px)")).toBeInTheDocument();
    expect(
      screen.getByText("(prefers-reduced-motion: reduce)"),
    ).toBeInTheDocument();
  });
});
