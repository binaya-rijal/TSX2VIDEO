
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SceneDefinition, RenderingStatus, AspectRatio, Resolution } from './types';
import { drawFrame } from './services/renderService';

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

// Parse TSX to SceneDefinition
const parseTsxToScene = (tsxCode: string, aspectRatio: AspectRatio, duration: number, fps: number): SceneDefinition | null => {
  try {
    const layers: any[] = [];
    
    // Extract Shape components
    const shapeRegex = /<Shape([^/>]*(?:\/>|>[^<]*<\/Shape>))/g;
    let match;
    let layerId = 0;
    
    while ((match = shapeRegex.exec(tsxCode)) !== null) {
      const props = match[1];
      layers.push({
        id: `shape-${layerId++}`,
        type: 'shape',
        style: extractProps(props),
        animations: extractAnimations(props)
      });
    }
    
    // Extract Text components
    const textRegex = /<Text([^>]*)>([^<]*)<\/Text>/g;
    while ((match = textRegex.exec(tsxCode)) !== null) {
      const props = match[1];
      const content = match[2].trim();
      layers.push({
        id: `text-${layerId++}`,
        type: 'text',
        content,
        style: extractProps(props),
        animations: extractAnimations(props)
      });
    }
    
    // Extract Image components
    const imageRegex = /<Image([^/>]*)\/>/g;
    while ((match = imageRegex.exec(tsxCode)) !== null) {
      const props = match[1];
      const srcMatch = props.match(/src=["']([^"']+)["']|src=\{["']([^"']+)["']\}/);
      layers.push({
        id: `image-${layerId++}`,
        type: 'image',
        src: srcMatch ? (srcMatch[1] || srcMatch[2]) : '',
        style: extractProps(props),
        animations: extractAnimations(props)
      });
    }
    
    const width = aspectRatio === '16:9' ? 1920 : 1080;
    const height = aspectRatio === '16:9' ? 1080 : 1920;
    
    return {
      compositionConfig: {
        id: 'TSXScene',
        durationInSeconds: duration,
        fps: fps,
        width,
        height
      },
      preGeneratedData: {},
      layers
    };
  } catch (e) {
    console.error('TSX parsing error:', e);
    return null;
  }
};

// Helper to extract props from TSX attribute string
const extractProps = (propsStr: string): any => {
  const style: any = {};
  
  // Extract string props: prop="value" or prop={'value'}
  const stringProps = ['x', 'y', 'width', 'height', 'backgroundColor', 'color', 'textAlign'];
  stringProps.forEach(prop => {
    const regex = new RegExp(`${prop}=["']([^"']+)["']|${prop}=\\{["']([^"']+)["']\\}`);
    const match = propsStr.match(regex);
    if (match) style[prop] = match[1] || match[2];
  });
  
  // Extract number props: prop={123}
  const numberProps = ['fontSize', 'opacity', 'borderRadius', 'rotation'];
  numberProps.forEach(prop => {
    const regex = new RegExp(`${prop}=\\{([\\d.]+)\\}`);
    const match = propsStr.match(regex);
    if (match) style[prop] = parseFloat(match[1]);
  });
  
  // Handle width/height as numbers too
  ['width', 'height'].forEach(prop => {
    if (!style[prop]) {
      const regex = new RegExp(`${prop}=\\{([\\d.]+)\\}`);
      const match = propsStr.match(regex);
      if (match) style[prop] = parseFloat(match[1]);
    }
  });
  
  return style;
};

// Helper to extract animations from animate prop
const extractAnimations = (propsStr: string): any[] => {
  const animateMatch = propsStr.match(/animate=\{\[([\s\S]*?)\]\}/);
  if (!animateMatch) return [];
  
  const animationsStr = animateMatch[1];
  const animations: any[] = [];
  
  // Parse each animation object
  const animRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = animRegex.exec(animationsStr)) !== null) {
    const animStr = match[1];
    const anim: any = {};
    
    // Extract property
    const propMatch = animStr.match(/property:\s*["']([^"']+)["']/);
    if (propMatch) anim.property = propMatch[1];
    
    // Extract numeric values
    ['startFrame', 'endFrame'].forEach(key => {
      const m = animStr.match(new RegExp(`${key}:\\s*(\\d+)`));
      if (m) anim[key] = parseInt(m[1]);
    });
    
    // Extract from/to (can be string or number)
    const fromMatch = animStr.match(/from:\s*(["']([^"']+)["']|(\d+\.?\d*))/);
    if (fromMatch) anim.from = fromMatch[2] || parseFloat(fromMatch[3]);
    
    const toMatch = animStr.match(/to:\s*(["']([^"']+)["']|(\d+\.?\d*))/);
    if (toMatch) anim.to = toMatch[2] || parseFloat(toMatch[3]);
    
    // Extract easing
    const easingMatch = animStr.match(/easing:\s*["']([^"']+)["']/);
    if (easingMatch) anim.easing = easingMatch[1];
    
    if (anim.property) animations.push(anim);
  }
  
  return animations;
};

const App: React.FC = () => {
  const [tsxInput, setTsxInput] = useState(DEFAULT_TSX);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<number>(7);
  const [fps, setFps] = useState<number>(30);
  const [resolution, setResolution] = useState<Resolution>('1080p');
  const [status, setStatus] = useState<RenderingStatus>({ step: 'idle', message: '', progress: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [refImage, setRefImage] = useState<{data: string, mimeType: string} | null>(null);
  const [parsedScene, setParsedScene] = useState<SceneDefinition | null>(null);
  const [tsxError, setTsxError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
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
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dims = useMemo(() => {
    const res = resolution === '1080p' ? 1080 : 720;
    // Applied requested 8px reduction from base monitor resolution
    if (aspectRatio === '16:9') return { w: ((res * 16) / 9) - 8, h: res - 8 };
    return { w: ((res * 9) / 16) - 8, h: res - 8 };
  }, [aspectRatio, resolution]);

  useEffect(() => {
    try {
      // Check for basic TSX structure
      if (tsxInput.includes('<Shape') || tsxInput.includes('<Text') || tsxInput.includes('<Image') || tsxInput.includes('function Scene')) {
        const parsed = parseTsxToScene(tsxInput, aspectRatio, duration, fps);
        if (parsed && parsed.layers.length > 0) {
          setParsedScene(parsed);
          setTsxError(null);
        } else if (tsxInput.trim()) {
          // Allow empty/minimal TSX without error
          setParsedScene({
            compositionConfig: {
              id: "EmptyScene",
              durationInSeconds: duration,
              fps: fps,
              width: aspectRatio === '16:9' ? 1920 : 1080,
              height: aspectRatio === '16:9' ? 1080 : 1920
            },
            preGeneratedData: {},
            layers: []
          });
          setTsxError(null);
        }
      } else if (tsxInput.trim()) {
        setTsxError("No valid components found");
      } else {
        setTsxError(null);
      }
    } catch (e: any) {
      setTsxError("Parse Error");
    }
  }, [tsxInput, aspectRatio, duration, fps]);

  useEffect(() => {
    const frameInterval = 1000 / fps;
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const deltaTime = time - lastFrameTimeRef.current;
      if (deltaTime >= frameInterval) {
        lastFrameTimeRef.current = time - (deltaTime % frameInterval);
        if (parsedScene && previewCanvasRef.current) {
          const ctx = previewCanvasRef.current.getContext('2d');
          if (ctx) {
            const elapsed = (time - startTimeRef.current) / 1000;
            const t = elapsed % duration; 
            drawFrame(ctx, parsedScene, t, dims.w, dims.h);
          }
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [parsedScene, dims, duration, fps]);

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
      const systemInstruction = `You are a TSX video scene generator. Read the user's prompt carefully. Output ONLY valid TSX code.

CRITICAL RULES:
1. Output pure TSX code only - no markdown code blocks, no explanation
2. Keep scenes CONCISE: max 8-10 components
3. Complete the TSX fully - never truncate
4. Start with: export default function Scene({ frame, fps, width, height }: SceneProps)

Specs: ${aspectRatio}, 7s duration, 30fps, ${aspectRatio === '16:9' ? '1920x1080' : '1080x1920'}

Available Components:
- <Shape x="50%" y="50%" width="100%" height="100%" backgroundColor="#color" opacity={1} borderRadius={0} animate={[...]} />
- <Text x="50%" y="50%" fontSize={72} color="#fff" opacity={1} animate={[...]}>Content</Text>
- <Image src="url" x="50%" y="50%" width={200} height={200} opacity={1} animate={[...]} />

Animation format in animate prop:
animate={[
  { property: "opacity", startFrame: 0, endFrame: 30, from: 0, to: 1, easing: "easeOutCubic" },
  { property: "y", startFrame: 0, endFrame: 60, from: "60%", to: "50%", easing: "easeOutCubic" }
]}

Animatable properties: x, y, opacity, width, height, rotation. Use % for positions.

Example:
export default function Scene({ frame, fps, width, height }: SceneProps) {
  return (
    <>
      <Shape x="50%" y="50%" width="100%" height="100%" backgroundColor="#020617" />
      <Text x="50%" y="50%" fontSize={72} color="#ffffff" opacity={0} animate={[{ property: "opacity", startFrame: 0, endFrame: 30, from: 0, to: 1, easing: "easeOutCubic" }]}>Hello World</Text>
    </>
  );
}

TSX:`;

      const userText = isEditMode
        ? `Modify this scene based on: "${aiPrompt}". Current TSX: ${tsxInput}`
        : aiPrompt;

      let responseText = '';

      // Call appropriate API based on provider
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userText }
            ],
            temperature: 0.3,
            max_tokens: 16000
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `BigModel API Error: ${response.status}`);
        }
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'mistral') {
        const response = await fetch(PROVIDERS.mistral.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userText }
            ],
            temperature: 0.3,
            max_tokens: 16000
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Mistral API Error: ${response.status}`);
        }
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'groq') {
        const response = await fetch(PROVIDERS.groq.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentApiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userText }
            ],
            temperature: 0.3,
            max_tokens: 16000
          })
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Groq API Error: ${response.status}`);
        }
        const data = await response.json();
        responseText = data.choices?.[0]?.message?.content || '';
      }

      console.log('AI Response:', responseText);
      
      // Extract TSX code from response
      let tsxCode = responseText;
      
      // Remove markdown code blocks if present
      tsxCode = tsxCode.replace(/```tsx?\n?/g, '').replace(/```\n?/g, '');
      
      // Find the function declaration
      const funcMatch = tsxCode.match(/(export\s+default\s+function\s+Scene[\s\S]*)/i);
      if (funcMatch) {
        tsxCode = funcMatch[1].trim();
      } else {
        // Try to find any function with Scene
        const altMatch = tsxCode.match(/(function\s+Scene[\s\S]*)/i);
        if (altMatch) {
          tsxCode = 'export default ' + altMatch[1].trim();
        }
      }
      
      // Validate it has our components
      if (tsxCode.includes('function Scene') && (tsxCode.includes('<Shape') || tsxCode.includes('<Text') || tsxCode.includes('<Image'))) {
        setTsxInput(tsxCode);
        setAiPrompt('');
        setRefImage(null);
        setStatus({ step: 'idle', message: '', progress: 0 });
      } else {
        throw new Error('No valid TSX scene found in response');
      }
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

  const startRecording = async () => {
    if (!parsedScene) return;
    setStatus({ step: 'recording', message: 'Rendering...', progress: 0 });
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const stream = canvas.captureStream(fps);
    
    // Try MP4 first, fallback to WebM
    const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') 
      ? 'video/mp4;codecs=avc1' 
      : 'video/webm;codecs=vp9';
    const isMP4 = mimeType.startsWith('video/mp4');
    
    const recorder = new MediaRecorder(stream, { mimeType, bitsPerSecond: 12000000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: isMP4 ? 'video/mp4' : 'video/webm' });
      const url = URL.createObjectURL(blob);
      
      // Generate filename from prompt or timestamp
      const baseName = aiPrompt 
        ? aiPrompt.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toLowerCase()
        : `video_${Date.now()}`;
      const extension = isMP4 ? 'mp4' : 'webm';
      const fileName = `${baseName}.${extension}`;
      
      setStatus({ step: 'completed', message: '', progress: 100, videoUrl: url, fileName });
    };
    recorder.start();
    
    const totalFrames = duration * fps;
    const frameDelay = 1000 / fps;
    for (let i = 0; i <= totalFrames; i++) {
      drawFrame(ctx, parsedScene, i / fps, dims.w, dims.h);
      setStatus(s => ({ ...s, progress: Math.round((i / totalFrames) * 100) }));
      await new Promise(r => setTimeout(r, frameDelay)); 
    }
    recorder.stop();
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

            {/* Active Model Selection - Only shows models from providers with valid API keys */}
            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Active Model for Generation</label>
              {(() => {
                const availableModels = (Object.keys(PROVIDERS) as ProviderKey[])
                  .filter(key => apiKeys[key]?.trim())
                  .flatMap(key => PROVIDERS[key].models.map(m => ({ ...m, provider: key, providerName: PROVIDERS[key].name })));
                
                if (availableModels.length === 0) {
                  return (
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-500">
                      <i className="fas fa-info-circle mr-2"></i>
                      Add API keys below to enable models
                    </div>
                  );
                }
                
                return (
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
                );
              })()}
            </div>

            <div className="border-t border-white/5 pt-4 mb-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">API Keys</label>
            </div>

            {/* API Keys for all providers */}
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
                <p className="text-[9px] text-slate-600 mt-1">
                  {key === 'gemini' && 'aistudio.google.com'}
                  {key === 'bigmodel' && 'open.bigmodel.cn'}
                  {key === 'mistral' && 'console.mistral.ai'}
                  {key === 'groq' && 'console.groq.com'}
                </p>
              </div>
            ))}

            {/* Save Button */}
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
            
            {/* AI Generation Card */}
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

            {/* Code Editor Card */}
            <div className="flex-[0.9] flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">TSX Scene</span>
                {tsxError && <span className="text-[9px] font-bold text-red-400 uppercase bg-red-400/10 px-2 py-0.5 rounded">{tsxError}</span>}
              </div>
              <textarea
                className="flex-1 bg-slate-950/50 border border-white/5 rounded-2xl p-4 code-font text-[11px] outline-none resize-none text-slate-300 focus:border-white/20 transition-all leading-relaxed"
                value={tsxInput}
                onChange={(e) => setTsxInput(e.target.value)}
                spellCheck={false}
              />
            </div>

            {/* Render Button */}
            <button
              onClick={startRecording}
              disabled={status.step === 'recording' || !!tsxError}
              className="w-full py-3.5 rounded-xl bg-white text-slate-950 font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-10"
            >
              <i className={`fas ${status.step === 'recording' ? 'fa-spinner fa-spin' : 'fa-video'}`}></i>
              {status.step === 'recording' ? `Rendering ${status.progress}%` : 'Export .MP4'}
            </button>
          </div>
        </aside>

        <section className="flex-1 relative flex items-center justify-center p-12 bg-[#000208] overflow-hidden">
          {/* Controls Overlay - Elevated Z-Index */}
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
            style={{ 
              width: '100%', 
              maxWidth: aspectRatio === '16:9' ? '872px' : '332px', 
              aspectRatio: aspectRatio === '16:9' ? '16/9' : '9/16' 
            }}
          >
            <canvas ref={previewCanvasRef} width={dims.w} height={dims.h} className="w-full h-full object-contain" />
          </div>

          <canvas ref={canvasRef} width={dims.w} height={dims.h} className="hidden" />

          {/* Export Overlay */}
          {status.step === 'completed' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[110] animate-in fade-in duration-300">
              <div className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] text-center max-w-xs w-full shadow-2xl">
                <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-check text-2xl text-slate-950"></i>
                </div>
                <h2 className="text-xl font-black mb-1 uppercase tracking-tight">Export Ready</h2>
                <p className="text-slate-500 text-xs mb-8 font-medium">Rendered at 1080p 30fps quality.</p>
                <div className="flex flex-col gap-3">
                  <a href={status.videoUrl} download={status.fileName || 'video.mp4'} className="w-full py-4 bg-white rounded-2xl font-black text-slate-950 text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-save"></i> Save Video
                  </a>
                  <button onClick={() => setStatus({ ...status, step: 'idle' })} className="w-full py-4 text-slate-600 text-[10px] font-black uppercase tracking-widest">Return</button>
                </div>
              </div>
            </div>
          )}

          {status.step === 'error' && (
             <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[120]">
               <i className="fas fa-exclamation-circle text-red-500"></i>
               <span className="text-xs font-bold text-red-400">{status.message}</span>
               <button onClick={() => setStatus({...status, step: 'idle'})} className="text-red-500 hover:text-red-400 px-2"><i className="fas fa-times"></i></button>
             </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
