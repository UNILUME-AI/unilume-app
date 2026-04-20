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
    expect(screen.getByLabelText("试算售价")).toHaveValue(profit.suggestedPrice);
    // Reset button hidden initially
    expect(screen.queryByRole("button", { name: "重置为建议价" })).not.toBeInTheDocument();
  });

  it("recomputes margin and net profit when price changes", () => {
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    const originalMargin = screen.getByText(/^\d+\.\d%$/).textContent!;

    // Double the price — margin should increase (fixed deductions shrink relatively).
    setPrice(screen.getByLabelText("试算售价"), String(profit.suggestedPrice * 2));

    const newMargin = screen.getByText(/^\d+\.\d%$/).textContent!;
    expect(parseFloat(newMargin)).toBeGreaterThan(parseFloat(originalMargin));
  });

  it("switches tag to '你的试算' and shows reset button after editing", () => {
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    setPrice(screen.getByLabelText("试算售价"), String(profit.suggestedPrice + 10));

    expect(screen.getByText("你的试算")).toBeInTheDocument();
    expect(screen.queryByText("Agent 建议")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置为建议价" })).toBeInTheDocument();
  });

  it("resets back to anchor when reset button clicked", async () => {
    const user = userEvent.setup();
    const profit = getMockProfitResponse("happy").data!;
    render(<PriceCompare anchor={profit} />);

    const input = screen.getByLabelText("试算售价") as HTMLInputElement;
    setPrice(input, "120");
    expect(input.value).toBe("120");

    await user.click(screen.getByRole("button", { name: "重置为建议价" }));
    expect(input.value).toBe(String(profit.suggestedPrice));
    expect(screen.getByText("Agent 建议")).toBeInTheDocument();
  });
});
