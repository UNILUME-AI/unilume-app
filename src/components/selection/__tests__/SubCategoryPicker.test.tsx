import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SubCategoryPicker from "../SubCategoryPicker";
import type { SubCategory } from "@/lib/selection/mock/types";

const CATS: SubCategory[] = [
  {
    id: "desk",
    name: "Desk Fans",
    nameZh: "桌面风扇",
    count: 3000,
    priceBand: { min: 29, max: 45, currency: "AED" },
    competitionLevel: "high",
    competitionScore: 4,
  },
  {
    id: "neck",
    name: "Neck Fans",
    nameZh: "挂脖风扇",
    count: 800,
    priceBand: { min: 49, max: 89, currency: "AED" },
    competitionLevel: "mod",
    competitionScore: 3,
  },
];

describe("SubCategoryPicker", () => {
  it("renders all option cards with Chinese + English names", () => {
    render(<SubCategoryPicker options={CATS} onSelect={() => {}} />);
    expect(screen.getByText("Desk Fans")).toBeInTheDocument();
    expect(screen.getByText("桌面风扇")).toBeInTheDocument();
    expect(screen.getByText("Neck Fans")).toBeInTheDocument();
    expect(screen.getByText("挂脖风扇")).toBeInTheDocument();
  });

  it("invokes onSelect with the full SubCategory object when a card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<SubCategoryPicker options={CATS} onSelect={onSelect} />);

    await user.click(screen.getByText("Neck Fans").closest("button")!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(CATS[1]);
  });

  it("reflects selection via data-selected attribute", async () => {
    const user = userEvent.setup();
    render(<SubCategoryPicker options={CATS} onSelect={() => {}} />);

    const deskButton = screen.getByText("Desk Fans").closest("button")!;
    expect(deskButton).toHaveAttribute("data-selected", "false");

    await user.click(deskButton);
    expect(deskButton).toHaveAttribute("data-selected", "true");
  });

  it("renders the warning footnote about variants", () => {
    render(<SubCategoryPicker options={CATS} onSelect={() => {}} />);
    expect(screen.getByText(/实际独立产品数更少/)).toBeInTheDocument();
  });
});
