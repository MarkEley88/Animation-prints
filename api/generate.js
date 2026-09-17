export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

  try {
    const { image, roomImage, artworkImage, style, scene, product, mode = 'preview' } = req.body || {};
    const visualiseRoom = mode === 'room-visualisation';
    const sourceImage = visualiseRoom ? artworkImage : image;

    if (!sourceImage || typeof sourceImage !== 'string' || !sourceImage.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Please provide a valid image.' });
    }
    if (visualiseRoom && (!roomImage || typeof roomImage !== 'string' || !roomImage.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'Please provide a room photo.' });
    }

    const isFinal = mode === 'final';
    const prompt = visualiseRoom
      ? [
          'Create a realistic interior visualisation using the supplied room photo and supplied finished artwork.',
          `Product: ${product || 'Canvas'}.`,
          'Place the supplied artwork naturally on a suitable wall in the room as a professionally framed wall piece.',
          'Keep the artwork itself faithful to the supplied finished artwork. Do not redraw, reinterpret or replace it.',
          'Respect the room photo perspective, wall geometry, lighting, shadows and scale so the result looks physically plausible.',
          'Keep the furniture, architecture and other important details of the room unchanged.',
          'Do not add people, text, logos or watermarks.',
          'Make the result look like a genuine photograph of the room after the artwork has been installed.'
        ].join(' ')
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

    const form = new FormData();
    form.append('model', 'gpt-image-2');

    const appendImage = (dataUrl, filename) => {
      const [meta, encoded] = dataUrl.split(',', 2);
      const mimeMatch = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
      if (!mimeMatch || !encoded) throw new Error(`Invalid image data for ${filename}.`);
      const inputBuffer = Buffer.from(encoded, 'base64');
      form.append('image', new Blob([inputBuffer], { type: mimeMatch[1] }), filename);
    };

    if (visualiseRoom) {
      appendImage(roomImage, 'room.png');
      appendImage(artworkImage, 'artwork.png');
      form.append('size', '1024x1024');
      form.append('quality', 'medium');
    } else {
      const [meta] = image.split(',', 2);
      const mimeMatch = meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);
      const extension = mimeMatch ? mimeMatch[1].split('/')[1] : 'png';
      appendImage(image, `source.${extension}`);
      form.append('size', isFinal ? '1024x1024' : '512x512');
      form.append('quality', isFinal ? 'high' : 'low');
    }

    form.append('prompt', prompt);
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
