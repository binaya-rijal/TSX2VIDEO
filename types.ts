
export type AspectRatio = '16:9' | '9:16';
export type Resolution = '720p' | '1080p';

// Added VideoScene interface to support Veo model generation parameters used in geminiService.ts
export interface VideoScene {
  prompt: string;
  style?: string;
  lighting?: string;
  camera?: string;
  mood?: string;
}

// TSX Component Props for video elements
export interface SceneProps {
  frame: number;
  fps: number;
  width: number;
  height: number;
  durationInSeconds: number;
}

export interface ShapeProps {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  opacity?: number;
  borderRadius?: number;
  rotation?: number;
  animate?: AnimationConfig[];
}

export interface TextProps {
  children: string;
  x?: string | number;
  y?: string | number;
  fontSize?: number;
  color?: string;
  opacity?: number;
  textAlign?: 'left' | 'center' | 'right';
  rotation?: number;
  animate?: AnimationConfig[];
}

export interface ImageProps {
  src: string;
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  opacity?: number;
  rotation?: number;
  animate?: AnimationConfig[];
}

export interface AnimationConfig {
  property: string;
  startFrame: number;
  endFrame: number;
  from: number | string;
  to: number | string;
  easing?: 'easeOutCubic' | 'linear';
}

export interface Animation {
  property: string;
  startFrame: number;
  endFrame: number;
  from: number | string;
  to: number | string;
  easing?: 'easeOutCubic' | 'linear';
}

export interface LayerStyle {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  opacity?: number;
  borderRadius?: number;
  shapeType?: 'rect' | 'circle';
  textAlign?: 'left' | 'center' | 'right';
  [key: string]: any;
}

export interface Layer {
  id: string;
  type: 'shape' | 'text' | 'image';
  style: LayerStyle;
  animations: Animation[];
  content?: string;
  src?: string;
}

export interface CompositionConfig {
  id: string;
  durationInSeconds: number;
  fps: number;
  width: number;
  height: number;
}

export interface SceneDefinition {
  compositionConfig: CompositionConfig;
  preGeneratedData: any;
  layers: Layer[];
}

export interface RenderingStatus {
  step: 'idle' | 'rendering' | 'recording' | 'completed' | 'error' | 'ai-thinking';
  message: string;
  progress: number;
  videoUrl?: string;
  fileName?: string;
}
