import { AspectRatio, Resolution, VideoScene } from "../types";

export const generateVideo = async (
  scene: VideoScene,
  aspectRatio: AspectRatio,
  resolution: Resolution,
  onProgress: (message: string) => void
): Promise<string> => {
  // Note: This service is deprecated - video generation now uses in-app settings
  // API keys are stored in localStorage via the Settings modal
  
  const apiKey = localStorage.getItem('apikey_bigmodel') || '';
  if (!apiKey) {
    throw new Error('Please set your API key in Settings');
  }
  
  const finalPrompt = `${scene.prompt}. ${scene.style ? `Style: ${scene.style}.` : ''} ${scene.lighting ? `Lighting: ${scene.lighting}.` : ''} ${scene.camera ? `Camera movement: ${scene.camera}.` : ''} ${scene.mood ? `Mood: ${scene.mood}.` : ''}`;

  onProgress("Initializing GLM AI engine...");

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-plus',
        messages: [
          {
            role: 'user',
            content: `Generate a video description for: ${finalPrompt}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`GLM API error: ${response.statusText}`);
    }

    const data = await response.json();
    onProgress("Processing response...");

    // Note: Actual video generation would require different implementation
    // This is a placeholder that returns the text response
    const content = data.choices?.[0]?.message?.content || '';
    
    throw new Error("Video generation is not available with GLM API. GLM focuses on text and image understanding, not video generation.");
  } catch (err: any) {
    throw err;
  }
};

const getRandomProgressMessage = () => {
  const messages = [
    "Processing with GLM AI...",
    "Analyzing scene composition...",
    "Generating content...",
    "Almost there..."
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};
