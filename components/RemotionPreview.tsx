import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import * as Remotion from 'remotion';
import * as Babel from '@babel/standalone';
import * as Primitives from './RemotionPrimitives';

export type ExportProgress = {
    progress: number; // 0..1
    encodedFrames?: number;
    renderEstimatedTime?: number;
    doneIn?: number | null;
};

export type RemotionPreviewHandle = {
    renderMp4: (args: {
        fileName: string;
        onProgress?: (p: ExportProgress) => void;
    }) => Promise<{ blobUrl: string; fileName: string }>;
};

// Minimal mock require implementation for the browser environment.
// This is what lets user-pasted TSX "just run" without their own imports.
const createRequire = (mockModules: Record<string, any>) => {
    return (moduleName: string) => {
        if (mockModules[moduleName]) return mockModules[moduleName];

        // Support React's JSX runtime when Babel chooses the "automatic" runtime.
        if (moduleName === 'react/jsx-runtime' || moduleName === 'react/jsx-dev-runtime') {
            const ReactModule = mockModules['react'];
            if (!ReactModule) return {};
            return {
                Fragment: ReactModule.Fragment,
                jsx: ReactModule.createElement,
                jsxs: ReactModule.createElement,
            };
        }

        // If it's unknown, return an empty object instead of crashing the whole preview.
        // User code that depends on it will still likely break, but compilation won't fail early.
        return {};
    };
};

interface PreviewProps {
    code: string;
    durationInSeconds: number;
    fps: number;
    width: number;
    height: number;
    autoPlay?: boolean;
}

// Actual component with imperative export.
const RemotionPreviewForward = forwardRef<RemotionPreviewHandle, PreviewProps>((props, ref) => {
    // We render the original component logic by copying it into this wrapper.
    // This keeps the diff smaller than rewriting everything, while still enabling export.
    const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { code, durationInSeconds, fps, width, height, autoPlay } = props;

    useEffect(() => {
        const compile = async () => {
            try {
                const stripUserImports = (input: string) =>
                    input
                        .replace(/^\s*import\s+type\s+[^;]+;\s*$/gm, '')
                        .replace(/^\s*import\s+[^;]+;\s*$/gm, '');

                const imports = `
                  import React from 'react';
                  // Make common React hooks available as globals so user TSX can just call useState(), useEffect(), etc.
                  const {
                    useState,
                    useEffect,
                    useRef,
                    useMemo,
                    useCallback,
                    useReducer,
                    useContext
                  } = React;

                  import * as Remotion from 'remotion';
                  const { 
                    useCurrentFrame,
                    useVideoConfig,
                    interpolate,
                    interpolateColors,
                    Easing,
                    spring,
                    random,
                    delayRender,
                    continueRender,
                    Sequence
                  } = Remotion as any;
                  import { Shape, Text, Image } from '@remotion/primitives';
                `;

                let userCode = stripUserImports(code);
                // If the user pasted just `function Scene(...) { ... }` or `const Scene = (...) => ...`
                // we still want it to work without them writing `export default`.
                if (!/export\s+default\s+/i.test(userCode)) {
                    const looksLikeScene =
                        /\bfunction\s+Scene\b/i.test(userCode) ||
                        /\bconst\s+Scene\s*=/i.test(userCode) ||
                        /\bScene\s*=\s*\(/i.test(userCode);
                    if (looksLikeScene) {
                        userCode = `${userCode}\n\nexport default Scene;`;
                    }
                }

                const fullCode = imports + '\n' + userCode;

                const result = Babel.transform(fullCode, {
                    presets: ['env', 'react', 'typescript'],
                    filename: 'scene.tsx',
                });

                if (!result.code) throw new Error("Compilation failed");

                const runCode = new Function('require', 'module', 'exports', result.code + '\nreturn module.exports;');

                const mockModules: Record<string, any> = {
                    'react': React,
                    'remotion': Remotion,
                    '@remotion/primitives': Primitives,
                };

                const requireFn = createRequire(mockModules);
                const moduleObj = { exports: {} };
                const exported = runCode(requireFn, moduleObj, moduleObj.exports);

                const Comp = exported.default || exported;

                if (typeof Comp !== 'function') {
                    throw new Error("Code must export a component as default (export default function Scene...)");
                }

                setComponent(() => Comp);
                setError(null);
            } catch (err: any) {
                console.error("Preview Compilation Error:", err);
                setError(err.message || "Unknown error");
            }
        };

        compile();
    }, [code]);

    const WrappedComponent = useMemo(() => {
        if (!Component) return null;

        const Wrapper: React.FC = () => {
            const frame = Remotion.useCurrentFrame();
            const config = Remotion.useVideoConfig();
            const durationSec = config.durationInFrames / config.fps;

            // Compatibility shim for generated scenes that reference common
            // dimension helpers as free variables (e.g. minDim).
            const compatGlobals = globalThis as Record<string, unknown>;
            compatGlobals.minDim = Math.min(config.width, config.height);
            compatGlobals.maxDim = Math.max(config.width, config.height);
            compatGlobals.centerX = config.width / 2;
            compatGlobals.centerY = config.height / 2;

            return (
                <Component
                    frame={frame}
                    fps={config.fps}
                    width={config.width}
                    height={config.height}
                    durationInSeconds={durationSec}
                />
            );
        };

        return Wrapper;
    }, [Component]);

    useImperativeHandle(ref, () => ({
        async renderMp4({ fileName, onProgress }) {
            if (!WrappedComponent) throw new Error('Preview is still compiling. Try again in a moment.');

            const durationInFrames = Math.round(durationInSeconds * fps);

            // Import only when exporting, to avoid any module side-effects breaking initial render.
            const { renderMediaOnWeb } = await import('@remotion/web-renderer');

            const result = await renderMediaOnWeb({
                composition: {
                    id: 'tsx2video',
                    component: WrappedComponent,
                    durationInFrames,
                    fps,
                    width,
                    height,
                },
                container: 'mp4',
                licenseKey: 'free-license',
                onProgress: (p) => {
                    // p.progress is 0..1
                    onProgress?.({
                        progress: p.progress,
                        encodedFrames: p.encodedFrames,
                        renderEstimatedTime: p.renderEstimatedTime,
                        doneIn: p.doneIn,
                    });
                },
            });

            const blob = await result.getBlob();
            const blobUrl = URL.createObjectURL(blob);
            return { blobUrl, fileName };
        }
    }), [WrappedComponent, durationInSeconds, fps, width, height]);

    if (error) {
        return (
            <div className="w-full h-full bg-red-950/30 border border-red-500/20 rounded-xl flex items-center justify-center p-6 grayscale">
                <div className="text-center text-red-400">
                    <div className="mb-2 text-xl opacity-50"><i className="fas fa-bug"></i></div>
                    <div className="font-mono text-[10px] whitespace-pre-wrap">{error}</div>
                </div>
            </div>
        );
    }

    if (!WrappedComponent) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#000208]">
                <div className="text-slate-600 animate-pulse text-xs uppercase font-bold tracking-widest">Compiling...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-full rounded-xl overflow-hidden bg-black relative">
            <Player
                component={WrappedComponent}
                durationInFrames={Math.round(durationInSeconds * fps)}
                fps={fps}
                compositionWidth={width}
                compositionHeight={height}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                }}
                controls
                autoPlay={autoPlay}
                loop
                initiallyShowControls={true}
            />
        </div>
    );
});

export default RemotionPreviewForward;
