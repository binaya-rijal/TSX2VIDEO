import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { ShapeProps, TextProps, ImageProps, AnimationConfig } from '../types';

const parseValue = (val: string | number | undefined, base: number): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.endsWith('%')) {
      return (parseFloat(val) / 100) * base;
    }
    return parseFloat(val) || 0;
  }
  return 0;
};

const resolveEasing = (easingName?: string) => {
  if (easingName === 'easeOutCubic') return Easing.out(Easing.cubic);
  if (easingName === 'linear') return Easing.linear;
  return Easing.linear;
};

const useLayerStyle = (
  props: any, 
  animations: AnimationConfig[] | undefined
): React.CSSProperties => {
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();

  // Helper to get initial value
  const getValue = (prop: string, defaultVal: any) => {
    return props[prop] !== undefined ? props[prop] : defaultVal;
  };

  const currentValues: any = {};
  
  // Initialize traceable properties
  // Dimensions
  currentValues.x = getValue('x', 0); // numeric if possible, we will parse
  currentValues.y = getValue('y', 0);
  currentValues.width = getValue('width', 100);
  currentValues.height = getValue('height', 100);
  currentValues.rotation = getValue('rotation', 0);
  currentValues.opacity = getValue('opacity', 1);
  currentValues.borderRadius = getValue('borderRadius', 0);
  currentValues.fontSize = getValue('fontSize', 48);
  
  // Non-interpolated (style only)
  currentValues.backgroundColor = getValue('backgroundColor', 'transparent');
  currentValues.color = getValue('color', 'white');
  currentValues.textAlign = getValue('textAlign', 'center');

  // Apply animations
  if (animations) {
    animations.forEach(anim => {
      const { property, startFrame, endFrame, from, to, easing } = anim;
      
      const baseDim = (property === 'x' || property === 'width') ? compWidth : compHeight;
      const startVal = parseValue(from, baseDim);
      const endVal = parseValue(to, baseDim);

      const interpolated = interpolate(
        frame,
        [startFrame, endFrame],
        [startVal, endVal],
        {
          easing: resolveEasing(easing),
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }
      );

      currentValues[property] = interpolated;
    });
  }

  // Convert to CSS
  const toCss = (val: any) => typeof val === 'number' ? `${val}px` : val;
  const toCssVal = (val: any) => val; 

  // We need to resolve start values for x/y/width/height if they were passed as strings (e.g. "50%") 
  // and NOT animated.
  // If they were animated, currentValues[prop] is a number (pixels).
  // If not animated, it might be string "50%".
  // The 'Shape' logic in legacy renderer:
  // x, y = center. w, h = dim.
  // ctx.translate(x, y). fillRect(-w/2, -h/2, w, h).
  // So standard CSS: left: x, top: y, text-align: center...
  // transform: translate(-50%, -50%) centers it.

  // We should rely on standard CSS values (numbers or strings)
  const x = currentValues.x;
  const y = currentValues.y;
  const w = currentValues.width;
  const h = currentValues.height;
  const r = currentValues.rotation;

  return {
    position: 'absolute',
    left: toCss(x),
    top: toCss(y),
    width: toCss(w),
    height: toCss(h),
    transform: `translate(-50%, -50%) rotate(${toCssVal(r)}deg)`,
    opacity: currentValues.opacity,
    backgroundColor: currentValues.backgroundColor,
    borderRadius: toCss(currentValues.borderRadius),
    color: currentValues.color,
    fontSize: toCss(currentValues.fontSize),
    textAlign: currentValues.textAlign,
    display: 'flex',
    alignItems: 'center',
    justifyContent: currentValues.textAlign === 'left' ? 'flex-start' : currentValues.textAlign === 'right' ? 'flex-end' : 'center',
    whiteSpace: 'nowrap', // For single line text usually, or wrap?
    // Text component usually allows wrapping? Legacy renderer: fillText supports only single line or basic wrap?
    // Legacy `ctx.fillText(layer.content)` is single line. 
    // We emulate that.
  };
};

export const Shape: React.FC<ShapeProps> = (props) => {
  const style = useLayerStyle(props, props.animate);
  return <div style={{...style}} />;
};

export const Text: React.FC<TextProps> = (props) => {
  const style = useLayerStyle(props, props.animate);
  return (
    <div style={{...style, fontFamily: "'Poppins', sans-serif", fontWeight: 'bold'}}>
      {props.children}
    </div>
  );
};

export const Image: React.FC<ImageProps> = (props) => {
  const style = useLayerStyle(props, props.animate);
  return <img src={props.src} style={{...style, objectFit: 'cover'}} alt="" />;
};
