export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    return;
  }

  try {
    const { image, style, scene } = req.body || {};

    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      res.status(400).json({ error: 'Please provide a valid image.' });
      return;
    }

    const prompt = [
      'Transform the supplied personal photo into a polished commercial-quality illustrated portrait suitable for a personalised print product.',
      `Illustration style: ${style || 'Fairytale Animation'}.`,
      `Scene: ${scene || 'Keep original'}.`,
      'Preserve the people, their identities, facial characteristics, expressions, pose and important clothing details from the source photo.',
      'Keep the result warm, appealing, clean and print-ready. Do not add text, logos, watermarks or extra people.',
      scene && scene !== 'Keep original' ? `Adapt the background naturally to the requested scene: ${scene}.` : 'Keep the original setting recognisable while improving it artistically.'
    ].join(' ');

    const [meta, encoded] = image.split(',', 2);
    const mimeMatch = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
    if (!mimeMatch || !encoded) {
      res.status(400).json({ error: 'Invalid image data.' });
      return;
    }

    const inputBuffer = Buffer.from(encoded, 'base64');
    const inputBlob = new Blob([inputBuffer], { type: mimeMatch[1] });

    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('image', inputBlob, `source.${mimeMatch[1].split('/')[1]}`);
    form.append('prompt', prompt);
    form.append('size', '1024x1024');
    form.append('quality', 'medium');
    form.append('output_format', 'png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI image API error:', data);
      res.status(response.status).json({ error: data?.error?.message || 'Image generation failed.' });
      return;
    }

    const result = data?.data?.[0];
    if (!result?.b64_json) {
      res.status(502).json({ error: 'The image service returned no image.' });
      return;
    }

    res.status(200).json({ image: `data:image/png;base64,${result.b64_json}` });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Something went wrong while creating the artwork.' });
  }
}
