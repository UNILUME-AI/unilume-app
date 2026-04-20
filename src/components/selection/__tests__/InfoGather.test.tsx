import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InfoGather from "../InfoGather";

/** antd InputNumber is sensitive to rapid typed input events in jsdom.
 *  We set values via a synchronous change event instead. */
function setInputNumber(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("InfoGather", () => {
  it("submit button starts disabled", () => {
    render(<InfoGather onSubmit={() => {}} />);
    expect(screen.getByRole("button", { name: "继续分析" })).toBeDisabled();
  });

  // NOTE: Separate "becomes enabled" test removed — the
  // "emits correctly-shaped payload on submit" test below implicitly
  // verifies the button is enabled (a disabled button swallows the click
  // and the onSubmit assertion would never pass).

  it("emits correctly-shaped payload on submit", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onSubmit = vi.fn();
    render(<InfoGather onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: "KSA" }));
    setInputNumber(screen.getByLabelText("采购成本最小值"), "50");
    setInputNumber(screen.getByLabelText("采购成本最大值"), "70");
    await user.click(screen.getByRole("radio", { name: "自发货 (DirectShip)" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "继续分析" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "继续分析" }));

    expect(onSubmit).toHaveBeenCalledWith({
      market: "KSA",
      costMinRmb: 50,
      costMaxRmb: 70,
      fulfillment: "self",
    });
  });

  it("hides the Market row when market prop is preset", () => {
    render(<InfoGather market="UAE" onSubmit={() => {}} />);
    expect(screen.queryByText("目标市场")).not.toBeInTheDocument();
    expect(screen.getByText("采购成本")).toBeInTheDocument();
  });

  it("keeps submit disabled when costMax < costMin", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InfoGather market="UAE" onSubmit={() => {}} />);

    setInputNumber(screen.getByLabelText("采购成本最小值"), "50");
    setInputNumber(screen.getByLabelText("采购成本最大值"), "30"); // invalid
    await user.click(screen.getByRole("radio", { name: "FBN (仓配)" }));

    expect(screen.getByRole("button", { name: "继续分析" })).toBeDisabled();
  });
});
