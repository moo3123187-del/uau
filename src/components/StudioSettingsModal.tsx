import React, { useState } from 'react';
import { Camera, Code2, Keyboard, RotateCcw, Sliders, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface StudioSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'editor' | 'viewport' | 'studio' | 'shortcuts';

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-800/70 last:border-b-0 cursor-pointer">
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-100">{label}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors p-0.5 shrink-0 cursor-pointer ${
        checked ? 'bg-[#2563EB]' : 'bg-slate-700'
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </label>
);

export const StudioSettingsModal: React.FC<StudioSettingsModalProps> = ({ open, onClose }) => {
  const { settings, updateSetting, resetSettings, resetLayout } = useSettings();
  const [tab, setTab] = useState<SettingsTab>('editor');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-[#121824] border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Studio Settings</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize script editor behavior, 3D viewport camera, and workspace layout.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close studio settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800 flex items-center gap-2 overflow-x-auto bg-[#0F141F]">
          <button
            type="button"
            onClick={() => setTab('editor')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'editor'
                ? 'border-[#2563EB] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Script Editor
          </button>
          <button
            type="button"
            onClick={() => setTab('viewport')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'viewport'
                ? 'border-[#2563EB] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Viewport & Camera
          </button>
          <button
            type="button"
            onClick={() => setTab('studio')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'studio'
                ? 'border-[#2563EB] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Workspace & Audio
          </button>
          <button
            type="button"
            onClick={() => setTab('shortcuts')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'shortcuts'
                ? 'border-[#2563EB] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Shortcuts
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'editor' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-800/70">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-100">Font Size</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {settings.editorFontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={20}
                    step={1}
                    value={settings.editorFontSize}
                    onChange={(e) => updateSetting('editorFontSize', Number(e.target.value))}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-100 mb-1.5">Tab Indent Width</div>
                  <div className="flex gap-2">
                    {([2, 4] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => updateSetting('tabSize', sz)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                          settings.tabSize === sz
                            ? 'bg-[#182338] border-[#2563EB] text-white'
                            : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sz} Spaces
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <ToggleRow
                  label="Highlight Active Line"
                  description="Subtle background band behind the current cursor line."
                  checked={settings.highlightActiveLine}
                  onChange={(v) => updateSetting('highlightActiveLine', v)}
                />
                <ToggleRow
                  label="Word Wrap"
                  description="Wrap long lines inside the code editor instead of horizontal scrolling."
                  checked={settings.wordWrap}
                  onChange={(v) => updateSetting('wordWrap', v)}
                />
                <ToggleRow
                  label="Auto-Close Brackets & Quotes"
                  description="Automatically pair (), [], {}, and quotes while typing."
                  checked={settings.autoClosePairs}
                  onChange={(v) => updateSetting('autoClosePairs', v)}
                />
                <ToggleRow
                  label="Smart Block Indent & Auto-end"
                  description="Indent after then/do/function and insert matching end on Enter."
                  checked={settings.autoIndentBlocks}
                  onChange={(v) => updateSetting('autoIndentBlocks', v)}
                />
                <ToggleRow
                  label="Luau IntelliSense Autocomplete"
                  description="Show Roblox service, DataType, and method suggestions while typing."
                  checked={settings.autocompleteEnabled}
                  onChange={(v) => updateSetting('autocompleteEnabled', v)}
                />
              </div>
            </div>
          )}

          {tab === 'viewport' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-800/70">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-100">Camera Field of View</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {settings.cameraFov}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={90}
                    step={2}
                    value={settings.cameraFov}
                    onChange={(e) => updateSetting('cameraFov', Number(e.target.value))}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-100">Edit Camera Fly Speed</span>
                    <span className="font-mono text-sky-400 tabular-nums">
                      {settings.cameraSpeed.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.25}
                    value={settings.cameraSpeed}
                    onChange={(e) => updateSetting('cameraSpeed', Number(e.target.value))}
                    className="w-full accent-[#2563EB] cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <ToggleRow
                  label="Show World Origin Axes"
                  description="Display X/Y/Z axis gizmo at the center of the Baseplate."
                  checked={settings.showAxes}
                  onChange={(v) => updateSetting('showAxes', v)}
                />
                <ToggleRow
                  label="Show Studded Baseplate Grid"
                  description="Render classic Roblox stud grid lines across the floor."
                  checked={settings.showBaseplateGrid}
                  onChange={(v) => updateSetting('showBaseplateGrid', v)}
                />
              </div>
            </div>
          )}

          {tab === 'studio' && (
            <div className="space-y-4">
              <div>
                <ToggleRow
                  label="Clear Output on Play"
                  description="Automatically clear previous print() logs each time Play starts."
                  checked={settings.autoClearOutputOnPlay}
                  onChange={(v) => updateSetting('autoClearOutputOnPlay', v)}
                />
                <ToggleRow
                  label="Studio Sound Effects"
                  description="Play synthesized audio feedback on lesson pass and in-game Sound:Play()."
                  checked={settings.soundEnabled}
                  onChange={(v) => updateSetting('soundEnabled', v)}
                />
              </div>

              <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-slate-100">Panel Proportions</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Drag any panel border to resize, or double-click a divider to snap back.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#192233] hover:bg-[#233047] text-slate-200 text-xs font-medium whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Layout
                </button>
              </div>
            </div>
          )}

          {tab === 'shortcuts' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {[
                ['F5 / Shift+F5', 'Play / Stop Playtest'],
                ['Ctrl+Enter', 'Check Solution'],
                ['Ctrl+F', 'Find & Replace in Script'],
                ['Ctrl+/', 'Toggle Line Comment (--)'],
                ['Alt+Up / Down', 'Move Line Up or Down'],
                ['Tab / Shift+Tab', 'Indent / Outdent Selection'],
                ['Ctrl+Space', 'Trigger IntelliSense'],
                ['F (Viewport)', 'Focus Camera on Selected Part'],
                ['WASD / Q / E', 'Fly Camera (Edit) / Walk (Play)'],
                ['Shift (Viewport)', 'Precision Slow Camera Movement'],
                ['Alt+S', 'Open Studio Settings'],
              ].map(([keys, desc]) => (
                <div
                  key={keys}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800"
                >
                  <span className="text-slate-300">{desc}</span>
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#182338] border border-slate-700 text-sky-300 shrink-0">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 bg-[#0F141F] flex items-center justify-between">
          <button
            type="button"
            onClick={resetSettings}
            className="text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Restore Default Settings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
