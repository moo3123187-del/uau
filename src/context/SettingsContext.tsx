import React, { createContext, useContext, useEffect, useState } from 'react';
import { PanelLayout, StudioSettings } from '../types/studio';

const SETTINGS_STORAGE_KEY = 'luaucraft_studio_settings_v1';
const LAYOUT_STORAGE_KEY = 'luaucraft_panel_layout_v1';

function getRecommendedUiScale(): StudioSettings['uiTextScale'] {
  if (typeof window !== 'undefined' && window.innerWidth >= 1600) {
    return 'large';
  }
  return 'standard';
}

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  editorFontSize: 14,
  uiTextScale: 'standard',
  tabSize: 2,
  wordWrap: false,
  autoClosePairs: true,
  autoIndentBlocks: true,
  autocompleteEnabled: true,
  highlightActiveLine: true,
  cameraFov: 70,
  cameraSpeed: 1.0,
  showAxes: true,
  showBaseplateGrid: true,
  autoClearOutputOnPlay: true,
  soundEnabled: true,
};

export function getDefaultPanelLayout(): PanelLayout {
  if (typeof window === 'undefined') {
    return {
      guideWidth: 340,
      inspectorWidth: 300,
      consoleHeight: 200,
      editorSplitPct: 50,
      explorerSplitPct: 52,
    };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const is2KPlus = w >= 2000;
  const isUltrawide = w >= 1600;
  const isLarge = w >= 1360;
  return {
    guideWidth: is2KPlus ? 440 : isUltrawide ? 395 : isLarge ? 350 : 310,
    inspectorWidth: is2KPlus ? 360 : isUltrawide ? 330 : isLarge ? 295 : 265,
    consoleHeight: h >= 1100 ? 250 : h >= 900 ? 210 : 175,
    editorSplitPct: 50,
    explorerSplitPct: 52,
  };
}

function loadSavedSettings(): StudioSettings {
  const recommendedScale = getRecommendedUiScale();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STUDIO_SETTINGS, uiTextScale: recommendedScale };
    }
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    const validScale =
      parsed.uiTextScale === 'compact' ||
      parsed.uiTextScale === 'standard' ||
      parsed.uiTextScale === 'large'
        ? parsed.uiTextScale
        : recommendedScale;
    return {
      ...DEFAULT_STUDIO_SETTINGS,
      ...parsed,
      uiTextScale: validScale,
      editorFontSize: Math.max(12, Math.min(20, Number(parsed.editorFontSize ?? 14))),
      tabSize: parsed.tabSize === 4 ? 4 : 2,
      cameraFov: Math.max(50, Math.min(90, Number(parsed.cameraFov ?? 70))),
      cameraSpeed: Math.max(0.5, Math.min(3, Number(parsed.cameraSpeed ?? 1.0))),
    };
  } catch {
    return { ...DEFAULT_STUDIO_SETTINGS, uiTextScale: recommendedScale };
  }
}

function loadSavedLayout(): PanelLayout {
  const defaults = getDefaultPanelLayout();
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PanelLayout>;
    return {
      guideWidth: Math.max(260, Math.min(580, Number(parsed.guideWidth ?? defaults.guideWidth))),
      inspectorWidth: Math.max(240, Math.min(480, Number(parsed.inspectorWidth ?? defaults.inspectorWidth))),
      consoleHeight: Math.max(120, Math.min(460, Number(parsed.consoleHeight ?? defaults.consoleHeight))),
      editorSplitPct: Math.max(28, Math.min(75, Number(parsed.editorSplitPct ?? defaults.editorSplitPct))),
      explorerSplitPct: Math.max(25, Math.min(75, Number(parsed.explorerSplitPct ?? defaults.explorerSplitPct))),
    };
  } catch {
    return defaults;
  }
}

interface SettingsContextValue {
  settings: StudioSettings;
  updateSetting: <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => void;
  resetSettings: () => void;
  layout: PanelLayout;
  updateLayout: (patch: Partial<PanelLayout>) => void;
  resetLayout: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StudioSettings>(() => loadSavedSettings());
  const [layout, setLayout] = useState<PanelLayout>(() => loadSavedLayout());

  useEffect(() => {
    const rootPx =
      settings.uiTextScale === 'compact'
        ? '15px'
        : settings.uiTextScale === 'large'
        ? '18px'
        : '16px';
    document.documentElement.style.fontSize = rootPx;
  }, [settings.uiTextScale]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Ignore storage quota errors
    }
  }, [layout]);

  const updateSetting = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings({ ...DEFAULT_STUDIO_SETTINGS, uiTextScale: getRecommendedUiScale() });
  };

  const updateLayout = (patch: Partial<PanelLayout>) => {
    setLayout((prev) => ({ ...prev, ...patch }));
  };

  const resetLayout = () => {
    setLayout(getDefaultPanelLayout());
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        layout,
        updateLayout,
        resetLayout,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
