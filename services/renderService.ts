
import { SceneDefinition, Layer, Animation, LayerStyle } from "../types";

const imageCache = new Map<string, HTMLImageElement>();

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const parseValue = (val: any, base: number): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.endsWith('%')) {
      return (parseFloat(val) / 100) * base;
    }
    return parseFloat(val) || 0;
  }
  return 0;
};

const getInterpolatedStyle = (layer: Layer, frame: number, width: number, height: number): LayerStyle => {
  const style = { ...layer.style };

  layer.animations.forEach((anim: Animation) => {
    const { property, startFrame, endFrame, from, to, easing } = anim;
    
    // Base value selection
    if (frame < startFrame) return;

    const baseDim = (property === 'x' || property === 'width') ? width : height;
    const startValue = parseValue(from, baseDim);
    const endValue = parseValue(to, baseDim);

    if (frame >= startFrame && frame <= endFrame) {
      const duration = endFrame - startFrame;
      if (duration === 0) {
        style[property] = endValue;
        return;
      }
      let progress = (frame - startFrame) / duration;
      if (easing === 'easeOutCubic') {
        progress = easeOutCubic(progress);
      }
      style[property] = startValue + (endValue - startValue) * progress;
    } else if (frame > endFrame) {
      style[property] = endValue;
    }
  });

  return style;
};

export const drawFrame = (
  ctx: CanvasRenderingContext2D, 
  scene: SceneDefinition, 
  t: number, 
  canvasWidth: number, 
  canvasHeight: number
) => {
  if (!scene || !scene.compositionConfig) return;

  const { width: compWidth, height: compHeight, fps } = scene.compositionConfig;
  const frame = Math.floor(t * fps);

  // Clear background
  ctx.fillStyle = scene.layers[0]?.style.backgroundColor || '#020617';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Scale context to fit composition into canvas
  ctx.save();
  const scale = Math.min(canvasWidth / compWidth, canvasHeight / compHeight);
  const offsetX = (canvasWidth - compWidth * scale) / 2;
  const offsetY = (canvasHeight - compHeight * scale) / 2;
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  scene.layers.forEach(layer => {
    const style = getInterpolatedStyle(layer, frame, compWidth, compHeight);
    
    ctx.save();
    
    const x = parseValue(style.x ?? 0, compWidth);
    const y = parseValue(style.y ?? 0, compHeight);
    const w = parseValue(style.width ?? 100, compWidth);
    const h = parseValue(style.height ?? 100, compHeight);
    const opacity = style.opacity ?? 1;
    const rotation = style.rotation ?? 0;

    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);

    if (layer.type === 'shape') {
      ctx.fillStyle = style.backgroundColor || style.color || 'white';
      if (style.shapeType === 'circle' || style.borderRadius) {
        const radius = style.borderRadius || Math.min(w, h) / 2;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, radius);
        ctx.fill();
      } else {
        ctx.fillRect(-w / 2, -h / 2, w, h);
      }
    } else if (layer.type === 'text') {
      const fontSize = style.fontSize || 48;
      ctx.fillStyle = style.color || 'white';
      ctx.font = `bold ${fontSize}px Poppins, sans-serif`;
      ctx.textAlign = (style.textAlign as CanvasTextAlign) || 'center';
      ctx.textBaseline = 'middle';
      if (style.textShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
      }
      ctx.fillText(layer.content || '', 0, 0);
    } else if (layer.type === 'image' && layer.src) {
      let img = imageCache.get(layer.src);
      if (!img) {
        img = new Image();
        img.src = layer.src;
        imageCache.set(layer.src, img);
      }
      if (img.complete) {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    }

    ctx.restore();
  });

  ctx.restore();
};
