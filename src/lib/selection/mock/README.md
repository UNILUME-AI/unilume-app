# Selection Agent — Mock Data Layer

Mock fixtures that drive `/mock/selection?scene=<id>`. Used during Sprint
#124 (UI design) until real tools (#108 / #111 / #112 / #113 / #114) land.

## Structure

```
mock/
├── types.ts          # Business types (T in ToolResponse<T>) + re-exports
├── scenes.ts         # Canonical scene IDs + metadata (titles, user queries)
├── market-data.ts    # getMockMarketResponse(scene)  → MarketIntelligenceResponse
├── profit-data.ts    # getMockProfitResponse(scene)  → ProfitCalcResponse
├── timing-data.ts    # getMockTimingResponse(scene)  → TimingIntelResponse
├── ui-state.ts       # getSceneUIState(scene) → verdict + risks + follow-ups
└── README.md         # this file
```

## Adding a new scene

1. **Add the id** in `scenes.ts`:
   - Append to the `SCENES` tuple
   - Add an entry to `SCENE_META`
   - Commit to `scenes.ts` first — TypeScript will now flag every missing
     switch-case below, guiding you to complete the scene.

2. **Fill in the 3 tool fixtures**:
   - `market-data.ts` — new `case "<scene>":` returning a
     `toolSuccess / toolPartial / toolError` of `MarketIntelligence`.
   - `profit-data.ts` — add a `ProfitInputs` constant, then add the case.
   - `timing-data.ts` — reuse an existing event table or create a new one,
     then add the case.

3. **Define the UI state** in `ui-state.ts`:
   - Add a `<SCENE>_STATE: SceneUIState` constant with verdict / risks /
     follow-ups / cost footer.
   - Add it to the `SCENE_STATES` map.

4. **Reload `/mock/selection?scene=<new-id>`** — the `SceneSwitcher`
   picks up ids from `SCENES` automatically.

## Design notes

- **Verdicts live in `ui-state.ts`, not tool responses.** A verdict is
  the *synthesis* of three tools plus domain heuristics — it's not
  something any single tool can rightfully own. Keeping tool types pure
  lets us replace mocks with real implementations (#111 / #113) without
  entangling Agent / UI concerns.

- **`calculateProfit()` in `profit-data.ts` mirrors the future tool.**
  When #111 lands, lift that function to `lib/selection/profit.ts` and
  point both mock + real callers at it.

- **Degraded scene uses `toolPartial`, not `toolError`.** Partial
  responses still carry the keyword + market so the Agent can write
  meaningful fallback narrative; error responses let the Agent fall
  through to tool-agnostic degradation text.

## Replacement checklist (when live tools arrive)

- [ ] #113 ships → delete `market-data.ts` exports, replace with real tool call
- [ ] #111 ships → delete `profit-data.ts` exports, lift `calculateProfit`
- [ ] #112 ships → delete `timing-data.ts` exports
- [ ] #114 Agent emits structured verdict → `deriveVerdict()` in
      `ui-state.ts` becomes pure fallback only
- [ ] `/mock/selection` may stay as a reference-scenes page, or get
      removed once the real chat flow covers all 6 scenes in staging
