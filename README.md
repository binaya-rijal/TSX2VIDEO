# TSX2VIDEO

Convert TSX React components to animated videos using AI.

## Features

- **TSX-based video scenes**: Write video scenes using familiar React TSX syntax
- **AI Generation**: Describe your video and AI generates TSX code for you
- **Live Preview**: See your animations in real-time as you edit
- **MP4 Export**: Export high-quality 1080p videos at 30fps
- **Multiple AI Providers**: Supports Gemini, BigModel, Mistral, and Groq

## TSX Components

### `<Shape>`
```tsx
<Shape
  x="50%" y="50%"
  width="100%" height="100%"
  backgroundColor="#020617"
  opacity={1}
  borderRadius={10}
  animate={[
    { property: "opacity", startFrame: 0, endFrame: 30, from: 0, to: 1, easing: "easeOutCubic" }
  ]}
/>
```

### `<Text>`
```tsx
<Text
  x="50%" y="50%"
  fontSize={72}
  color="#ffffff"
  opacity={1}
  animate={[...]}
>
  Your Text Here
</Text>
```

### `<Image>`
```tsx
<Image
  src="https://example.com/image.png"
  x="50%" y="50%"
  width={200} height={200}
  opacity={1}
  animate={[...]}
/>
```

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Open Settings and add your API key for your preferred provider
