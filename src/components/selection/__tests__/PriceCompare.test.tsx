import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PriceCompare from "../PriceCompare";
import { getMockProfitResponse } from "@/lib/selection/mock/profit-data";

function setPrice(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("PriceCompare", () => {
  it("shows the anchor price + 'Agent 建议' tag in initial state", () => {
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    expect(screen.getByText("Agent 建议")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(profit.suggestedPrice);
    // Reset button hidden initially
    expect(screen.queryByText("重置为建议价")).not.toBeInTheDocument();
  });

  it("recomputes margin and net profit when price changes", () => {
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    const originalMargin = screen.getByText(/^\d+\.\d%$/).textContent!;

    // Double the price — margin should increase (fixed deductions shrink relatively).
    setPrice(screen.getByRole("spinbutton"), String(profit.suggestedPrice * 2));

    const newMargin = screen.getByText(/^\d+\.\d%$/).textContent!;
    expect(parseFloat(newMargin)).toBeGreaterThan(parseFloat(originalMargin));
  });

  it("switches tag to '你的试算' and shows reset button after editing", () => {
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    setPrice(screen.getByRole("spinbutton"), String(profit.suggestedPrice + 10));

    expect(screen.getByText("你的试算")).toBeInTheDocument();
    expect(screen.queryByText("Agent 建议")).not.toBeInTheDocument();
    expect(screen.getByText("重置为建议价")).toBeInTheDocument();
  });

  it("resets back to anchor when reset button clicked", async () => {
    const user = userEvent.setup();
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    setPrice(input, "120");
    expect(input.value).toBe("120");

    await user.click(screen.getByText("重置为建议价").closest("button")!);
    expect(input.value).toBe(String(profit.suggestedPrice));
    expect(screen.getByText("Agent 建议")).toBeInTheDocument();
  });
});
