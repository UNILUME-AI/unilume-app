"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "antd";

import { SCENES, SCENE_META, isSceneId, type SceneId } from "@/lib/selection/mock/scenes";

export interface SceneSwitcherProps {
  /** Defaults to "happy" if the URL scene param is missing or invalid. */
  defaultScene?: SceneId;
}

/**
 * Top-of-page segmented toolbar for switching between the 6 demo scenes.
 * Syncs with URL (`?scene=<id>`) so users can share a specific scene and
 * Playwright can drive the switcher through query params.
 *
 * Renders a "MOCK" corner watermark to remind reviewers this page is
 * not the real chat — it's a design fixture.
 */
export default function SceneSwitcher({
  defaultScene = "happy",
}: SceneSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawScene = searchParams.get("scene");
  const activeScene: SceneId = isSceneId(rawScene) ? rawScene : defaultScene;

  const options = SCENES.map((id) => ({
    label: SCENE_META[id].title,
    value: id,
  }));

  const handleChange = (value: string | number) => {
    const next = String(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("scene", next);
    router.replace(`?${params.toString()}`);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded bg-stone-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
            mock
          </span>
          <h1 className="truncate text-[13px] font-semibold text-[var(--ink)]">
            Selection Agent 原型预览
          </h1>
          <span className="shrink-0 text-[11px] text-[var(--ink3)]">
            {SCENE_META[activeScene].description}
          </span>
        </div>
        <Segmented<string>
          options={options}
          value={activeScene}
          onChange={handleChange}
          size="small"
        />
      </div>
    </div>
  );
}
