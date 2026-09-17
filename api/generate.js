export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  try {
    const { image, roomImage, style, scene, mode = 'preview' } = req.body || {};
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Please provide a valid artwork image.' });
    }

    const isRoom = mode === 'room';
    const isFinal = mode === 'final';
    if (isRoom && (!roomImage || typeof roomImage !== 'string' || !roomImage.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'Please provide a valid room image.' });
    }

    const prompt = isRoom
      ? 'Use the supplied room photo as the exact environment. Place the supplied finished artwork as a printed picture inside a simple standard black frame on an appropriate visible wall. Keep the room, furniture, architecture, lighting and perspective realistic and recognisable. Make the framed print look naturally photographed in the room, with realistic scale, perspective, shadows and reflections where appropriate. Do not alter the artwork itself. Do not add people, text, logos or watermarks. The black frame is only a visualisation aid and is not part of the product purchase; the product being visualised is the printed artwork.'
      : [
          isFinal
            ? 'Create the final high-quality personalised artwork from the supplied photo, suitable for professional printing on a personalised product.'
            : 'Create a quick visual preview of the supplied photo in the requested illustration style. This is a low-resolution style-selection preview, not the final print artwork.',
          `Illustration style: ${style || 'Fairytale Animation'}.`,
          `Scene: ${scene || 'Keep original'}.`,
          'Preserve the people, identity, facial characteristics, expressions, pose and important clothing details from the source photo.',
          'Do not add text, logos, watermarks or extra people.',
          scene && scene !== 'Keep original'
            ? `Adapt the background naturally to the requested scene: ${scene}.`
            : 'Keep the original setting recognisable while interpreting it artistically.',
          isFinal
            ? 'Make the composition polished, attractive and suitable for printing.'
            : 'Prioritise speed and clear visual communication of the chosen style over fine detail.'
        ].join(' ');

    const parseImage = (dataUrl) => {
      const [meta, encoded] = dataUrl.split(',', 2);
      const mimeMatch = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
      if (!mimeMatch || !encoded) throw new Error('Invalid image data.');
      return { buffer: Buffer.from(encoded, 'base64'), mime: mimeMatch[1] };
    };

    const artwork = parseImage(image);
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('image', new Blob([artwork.buffer], { type: artwork.mime }), `artwork.${artwork.mime.split('/')[1]}`);

    if (isRoom) {
      const room = parseImage(roomImage);
      form.append('image[]', new Blob([room.buffer], { type: room.mime }), `room.${room.mime.split('/')[1]}`);
    }

    form.append('prompt', prompt);
    form.append('size', isFinal ? '1024x1024' : '1024x1024');
    form.append('quality', isFinal ? 'high' : 'low');
    form.append('output_format', 'png');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI image API error:', data);
      return res.status(response.status).json({ error: data?.error?.message || 'Image generation failed.' });
    }

    const result = data?.data?.[0];
    if (!result?.b64_json) return res.status(502).json({ error: 'The image service returned no image.' });

    return res.status(200).json({
      image: `data:image/png;base64,${result.b64_json}`,
      mode
    });
  } catch (error) {
    console.error('Generation error:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong while creating the image.' });
  }
}
