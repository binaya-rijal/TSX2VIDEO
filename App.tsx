
import React, { useState, useRef, useMemo } from 'react';
import { RenderingStatus, AspectRatio, Resolution } from './types';
import RemotionPreview, { type RemotionPreviewHandle } from './components/RemotionPreview';

// Provider configurations
const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Free)' },
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash (Free)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Free)' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Free)' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Free)' },
    ]
  },
  bigmodel: {
    name: 'BigModel (智谱)',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: [
      { id: 'glm-4.7', name: 'GLM-4.7 (Free)' },
      { id: 'glm-4.6', name: 'GLM-4.6' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Free)' },
      { id: 'glm-4-air', name: 'GLM-4 Air' },
    ]
  },
  mistral: {
    name: 'Mistral AI',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large' },
      { id: 'kimi-k2-0711-preview', name: 'Kimi K2' },
      { id: 'codestral-latest', name: 'Codestral' },
    ]
  },
  groq: {
    name: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
      { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
      { id: 'qwen-qwq-32b', name: 'Qwen QWQ 32B' },
    ]
  }
};

type ProviderKey = keyof typeof PROVIDERS;

const DEFAULT_TSX = `// TSX2VIDEO Scene Component
export default function Scene({ frame, fps, width, height }: SceneProps) {
  return (
    <>
      {/* Background */}
      <Shape
        x="50%" y="50%"
        width="100%" height="100%"
        backgroundColor="#020617"
      />
      
      {/* Animated Gradient Blob */}
      <Shape
        x="50%" y="50%"
        width={800} height={800}
        backgroundColor="#1e1b4b"
        borderRadius={400}
        opacity={0.4}
        animate={[
          { property: "width", startFrame: 0, endFrame: 210, from: 700, to: 900, easing: "linear" }
        ]}
      />
      
      {/* Main Title */}
      <Text
        x="50%" y="48%"
        fontSize={96}
        color="#ffffff"
        opacity={0}
        animate={[
          { property: "opacity", startFrame: 15, endFrame: 45, from: 0, to: 1, easing: "easeOutCubic" },
          { property: "y", startFrame: 15, endFrame: 60, from: "55%", to: "48%", easing: "easeOutCubic" }
        ]}
      >
        TSX2VIDEO PRO
      </Text>
    </>
  );
}`;

const App: React.FC = () => {
  const [tsxInput, setTsxInput] = useState(DEFAULT_TSX);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<number>(7);
  const [fps, setFps] = useState<number>(30);
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [status, setStatus] = useState<RenderingStatus>({ step: 'idle', message: '', progress: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [refImage, setRefImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Settings state - load from localStorage
  const [provider, setProvider] = useState<ProviderKey>(() =>
    (localStorage.getItem('ai_provider') as ProviderKey) || 'gemini'
  );
  const [selectedModel, setSelectedModel] = useState(() =>
    localStorage.getItem('ai_model') || PROVIDERS.gemini.models[0].id
  );
  const [apiKeys, setApiKeys] = useState<Record<ProviderKey, string>>(() => ({
    gemini: localStorage.getItem('apikey_gemini') || '',
    bigmodel: localStorage.getItem('apikey_bigmodel') || '',
    mistral: localStorage.getItem('apikey_mistral') || '',
    groq: localStorage.getItem('apikey_groq') || '',
  }));

  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const remotionPreviewRef = useRef<RemotionPreviewHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dims = useMemo(() => {
    const res = resolution === '1080p' ? 1080 : 720;
    // Applied requested 8px reduction from base monitor resolution, but ensure integer dimensions for Remotion Player
    const base = aspectRatio === '16:9'
      ? { w: (res * 16) / 9, h: res }
      : { w: (res * 9) / 16, h: res };

    return {
      w: Math.round(base.w - 8),
      h: Math.round(base.h - 8),
    };
  }, [aspectRatio, resolution]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setRefImage({ data: base64String, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleFullScreen = () => {
    if (previewWrapperRef.current) {
      if (!document.fullscreenElement) {
        previewWrapperRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt && !refImage) return;

    const currentApiKey = apiKeys[provider];
    if (!currentApiKey) {
      setShowSettings(true);
      setStatus({ step: 'error', message: 'Please set your API key in Settings', progress: 0 });
      return;
    }

    setStatus({ step: 'ai-thinking', message: isEditMode ? 'Editing...' : 'Generating...', progress: 0 });

    try {
      const systemInstruction = `You are a TSX video scene generator for Remotion. Read the user's prompt carefully. Output ONLY valid TSX code.

CRITICAL RULES:
1. Output pure TSX code only - no markdown code blocks, no explanation
2. Keep scenes CONCISE: max 15-20 components
3. Complete the TSX fully - never truncate
4. Start with: export default function Scene({ frame, fps, width, height }: SceneProps)
5. You can use React hooks, animations, and math.

Specs: ${aspectRatio}, 7s duration, 30fps, ${aspectRatio === '16:9' ? '1920x1080' : '1080x1920'}

Available Primitives (auto-imported):
- <Shape x="50%" y="50%" width="100%" height="100%" backgroundColor="#color" opacity={1} borderRadius={0} animate={[...]} />
- <Text x="50%" y="50%" fontSize={72} color="#fff" opacity={1} animate={[...]}>Content</Text>
- <Image src="url" x="50%" y="50%" width={200} height={200} opacity={1} animate={[...]} />

Animation format in animate prop:
animate={[
  { property: "opacity", startFrame: 0, endFrame: 30, from: 0, to: 1, easing: "easeOutCubic" },
]}

TSX:`;

      const userText = isEditMode
        ? `Modify this scene based on: "${aiPrompt}". Current TSX: ${tsxInput}`
        : aiPrompt;

      let responseText = '';

      // Call appropriate API based on provider
      // Reusing the exact same logic as before for fetching
      if (provider === 'gemini') {
        const url = `${PROVIDERS.gemini.endpoint}/${selectedModel}:generateContent?key=${currentApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemInstruction}\n\nUser request: ${userText}` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 16000 }
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Gemini API Error: ${response.status}`);
        }
        const data = await response.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'bigmodel') {
        const response = await fetch(PROVIDERS.bigmodel.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
          body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userText }], temperature: 0.3, max_tokens: 16000 })
        });
        if (!response.ok) throw new Error(`BigModel API Error: ${response.status}`);
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'mistral') {
        const response = await fetch(PROVIDERS.mistral.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
          body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userText }], temperature: 0.3, max_tokens: 16000 })
        });
        if (!response.ok) throw new Error(`Mistral API Error: ${response.status}`);
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'groq') {
        const response = await fetch(PROVIDERS.groq.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
          body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userText }], temperature: 0.3, max_tokens: 16000 })
        });
        if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      }

      console.log('AI Response:', responseText);

      let tsxCode = responseText;
      tsxCode = tsxCode.replace(/```tsx?\n?/g, '').replace(/```\n?/g, '');
      tsxCode = tsxCode.trim();

      // Prefer full "export default ..." code (supports function, const, arrow, etc).
      if (/export\s+default\s+/i.test(tsxCode)) {
        setTsxInput(tsxCode);
        setAiPrompt('');
        setRefImage(null);
        setStatus({ step: 'idle', message: '', progress: 0 });
        return;
      }

      // Fallback: allow bare `function Scene(...) { ... }` by wrapping it.
      const altMatch = tsxCode.match(/(function\s+Scene[\s\S]*)/i);
      if (altMatch) {
        const wrapped = ('export default ' + altMatch[1].trim()).trim();
        setTsxInput(wrapped);
        setAiPrompt('');
        setRefImage(null);
        setStatus({ step: 'idle', message: '', progress: 0 });
        return;
      }

      throw new Error('No valid TSX scene found in response (expected an `export default` Scene).');
    } catch (err: any) {
      console.error('Generation error:', err);
      setStatus({ step: 'error', message: err.message || 'AI Logic Failure', progress: 0 });
    }
  };

  const saveSettings = () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('ai_model', selectedModel);
    localStorage.setItem('apikey_gemini', apiKeys.gemini);
    localStorage.setItem('apikey_bigmodel', apiKeys.bigmodel);
    localStorage.setItem('apikey_mistral', apiKeys.mistral);
    localStorage.setItem('apikey_groq', apiKeys.groq);
    setShowSettings(false);
  };

  const exportMp4 = async (mode: 'download' | 'openInNewTab') => {
    if (!remotionPreviewRef.current) return;
    if (status.step === 'rendering') return;

    const safeFromPrompt = aiPrompt
      ? aiPrompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : '';
    const fileName = `${safeFromPrompt ? safeFromPrompt : 'tsx2video'}_${Date.now()}.mp4`;

    // If user right-clicks, open a new tab immediately to avoid popup blockers.
    const openedWin = mode === 'openInNewTab' ? window.open('', '_blank') : null;
    if (mode === 'openInNewTab' && !openedWin) {
      setStatus({ step: 'error', message: 'Popup blocked. Please allow popups to open the exported video.', progress: 0 });
      return;
    }

    if (openedWin) {
      // Give the user immediate feedback while Remotion is rendering.
      openedWin.document.title = 'TSX2VIDEO - Rendering MP4...';
      openedWin.document.body.style.margin = '0';
      openedWin.document.body.innerHTML = `
        <div style="
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
          background:#0b1020;
          color:#e5e7eb;
          height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          flex-direction:column;
          gap:12px;
        ">
          <div style="font-weight:800;font-size:18px;">Rendering MP4...</div>
          <div style="font-size:13px;color:#9ca3af;">This can take a while depending on your scene.</div>
        </div>
      `;
    }

    setStatus({ step: 'rendering', message: 'Rendering MP4...', progress: 0 });

    try {
      const { blobUrl } = await remotionPreviewRef.current.renderMp4({
        fileName,
        onProgress: (p) => {
          const pct = Math.max(0, Math.min(100, Math.round((p.progress ?? 0) * 100)));
          setStatus({
            step: 'rendering',
            message: `Rendering MP4... ${pct}%`,
            progress: pct,
          });
        },
      });

      if (mode === 'openInNewTab') {
        openedWin!.location.href = blobUrl;
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        a.click();
      }

      setStatus({ step: 'completed', message: '', progress: 100, videoUrl: blobUrl, fileName });
    } catch (err: any) {
      console.error('Export error:', err);
      if (openedWin) {
        openedWin.document.title = 'TSX2VIDEO - Export Failed';
        openedWin.document.body.innerHTML = `
          <div style="
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
            background:#0b1020;
            color:#ef4444;
            height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            text-align:center;
          ">
            <div>
              <div style="font-weight:800;font-size:18px;margin-bottom:10px;">Export failed</div>
              <div style="color:#fca5a5;font-size:13px;white-space:pre-wrap;">${String(err?.message || err || 'Unknown error')}</div>
            </div>
          </div>
        `;
      }
      setStatus({
        step: 'error',
        message: err?.message || 'Export failed. Try again.',
        progress: 0,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-white font-['Poppins']">
      <header className="px-6 py-3 flex items-center justify-between border-b border-white/5 bg-slate-900/20 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <i className="fas fa-play text-slate-900 text-xs"></i>
          </div>
          <span className="text-lg font-black tracking-tighter uppercase">TSX2VIDEO</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5">
            <button onClick={() => setAspectRatio('16:9')} className={`px-4 py-1 rounded-lg text-[10px] font-bold transition-all ${aspectRatio === '16:9' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>16:9</button>
            <button onClick={() => setAspectRatio('9:16')} className={`px-4 py-1 rounded-lg text-[10px] font-bold transition-all ${aspectRatio === '9:16' ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>9:16</button>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded-xl border border-white/5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</label>
            <input
              type="number"
              min="1"
              max="60"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
              className="w-12 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg outline-none focus:ring-1 focus:ring-white/30 text-center"
            />
            <span className="text-[10px] text-slate-500">s</span>
          </div>
          <div className="flex gap-2 bg-slate-900/50 p-1 rounded-xl border border-white/5">
            <button onClick={() => setFps(30)} className={`px-4 py-1 rounded-lg text-[10px] font-bold transition-all ${fps === 30 ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>30 FPS</button>
            <button onClick={() => setFps(60)} className={`px-4 py-1 rounded-lg text-[10px] font-bold transition-all ${fps === 60 ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-white'}`}>60 FPS</button>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 bg-slate-900/50 border border-white/5 rounded-xl text-slate-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200]" onClick={() => setShowSettings(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black uppercase tracking-tight">AI Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Active Model for Generation</label>
              <select
                value={`${provider}:${selectedModel}`}
                onChange={(e) => {
                  const [newProvider, ...modelParts] = e.target.value.split(':');
                  const newModel = modelParts.join(':');
                  setProvider(newProvider as ProviderKey);
                  setSelectedModel(newModel);
                }}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 transition-all"
              >
                {(Object.keys(PROVIDERS) as ProviderKey[])
                  .filter(key => apiKeys[key]?.trim())
                  .map(key => (
                    <optgroup key={key} label={PROVIDERS[key].name}>
                      {PROVIDERS[key].models.map(m => (
                        <option key={`${key}:${m.id}`} value={`${key}:${m.id}`}>{m.name}</option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            </div>

            <div className="border-t border-white/5 pt-4 mb-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">API Keys</label>
            </div>

            {(Object.keys(PROVIDERS) as ProviderKey[]).map(key => (
              <div key={key} className="mb-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2 block">
                  {PROVIDERS[key].name}
                  {apiKeys[key]?.trim() && <i className="fas fa-check-circle text-green-400 text-[8px]"></i>}
                </label>
                <input
                  type="password"
                  value={apiKeys[key]}
                  onChange={(e) => setApiKeys({ ...apiKeys, [key]: e.target.value })}
                  placeholder={`Enter ${PROVIDERS[key].name} API key...`}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-white/30 transition-all placeholder:text-slate-600"
                />
              </div>
            ))}

            <button
              onClick={saveSettings}
              className="w-full py-3.5 rounded-xl bg-white text-slate-950 font-black text-[11px] uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all mt-2"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        <aside className="w-[360px] border-r border-white/5 flex flex-col bg-slate-900/10 z-10 relative">
          <div className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">

            <div className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all ${isEditMode ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
              <div className="relative bg-slate-950/40 border border-white/5 rounded-xl p-3">
                <textarea
                  placeholder={isEditMode ? "How should it change?" : "Describe your video scene..."}
                  className="w-full bg-transparent border-none text-sm outline-none resize-none h-16 placeholder:text-slate-600"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button onClick={() => fileInputRef.current?.click()} className={`absolute right-3 bottom-3 text-slate-600 hover:text-white ${refImage ? 'text-white' : ''}`}>
                  <i className="fas fa-image"></i>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={status.step === 'ai-thinking' || (!aiPrompt && !refImage)}
                className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-20 ${isEditMode ? 'bg-green-400 text-slate-950' : 'bg-white text-slate-950'}`}
              >
                {status.step === 'ai-thinking' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sparkles"></i>}
                {isEditMode ? 'Apply Edits' : 'Generate TSX'}
              </button>
            </div>

            <div className="flex-[0.9] flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">TSX Scene</span>
              </div>
              <textarea
                className="flex-1 bg-slate-950/50 border border-white/5 rounded-2xl p-4 code-font text-[11px] outline-none resize-none text-slate-300 focus:border-white/20 transition-all leading-relaxed"
                value={tsxInput}
                onChange={(e) => setTsxInput(e.target.value)}
                spellCheck={false}
              />
            </div>

            {/* <button
              onClick={startRecording}
              className="w-full py-3.5 rounded-xl bg-white text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <i className="fas fa-download"></i>
              Export MP4
            </button> */}
          </div>
        </aside>

        <section className="flex-1 relative flex items-center justify-center p-12 bg-[#000208] overflow-hidden">
          <div className="absolute top-4 right-6 flex items-center gap-3 z-[100]">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 shadow-xl ${isEditMode ? 'bg-green-400 border-green-400 text-slate-950 shadow-green-400/20' : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
            >
              <i className="fas fa-magic"></i> Magic Edit
            </button>
            <button onClick={toggleFullScreen} className="w-11 h-11 bg-slate-900 border border-white/10 rounded-xl text-slate-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-center shadow-xl">
              <i className="fas fa-expand-alt"></i>
            </button>
          </div>

          <div
            ref={previewWrapperRef}
            className="relative shadow-[0_0_120px_rgba(0,0,0,0.9)] rounded-[2.5rem] overflow-hidden border border-white/10 bg-black flex items-center justify-center transition-all duration-700 z-0"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(false);
              exportMp4('openInNewTab');
            }}
            style={{
              width: '100%',
              maxWidth: aspectRatio === '16:9' ? '872px' : '332px',
              aspectRatio: aspectRatio === '16:9' ? '16/9' : '9/16'
            }}
          >
            <RemotionPreview
              ref={remotionPreviewRef}
              code={tsxInput}
              durationInSeconds={duration}
              fps={fps}
              width={dims.w}
              height={dims.h}
            />

            {(status.step === 'rendering' || status.step === 'error') && (
              <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 text-center max-w-[320px]">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                    {status.step === 'rendering' ? 'Rendering MP4' : 'Export Error'}
                  </div>
                  <div className="text-[11px] text-slate-200 mt-2 whitespace-pre-wrap">
                    {status.message || (status.step === 'rendering' ? 'Working...' : 'Something went wrong.')}
                  </div>
                </div>
              </div>
            )}

            {/* Context Menu Overlay */}
            <div className="absolute top-4 right-4 z-[50]">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                disabled={status.step === 'rendering'}
              >
                <i className="fas fa-ellipsis-v text-xs"></i>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-10 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      exportMp4('download');
                    }}
                    className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:bg-white/10 hover:text-white flex items-center gap-2"
                  >
                    <i className="fas fa-download"></i> Download MP4
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
