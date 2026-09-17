export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  try {
    const { image, roomImage, style, scene, mode = 'preview', creationMode = 'transform' } = req.body || {};
    const isExample = mode === 'example';
    const isRoom = mode === 'room';
    const isFinal = mode === 'final';
    const stylePrompts = {
      'Anime':'cinematic Japanese anime illustration, polished feature-film quality, expressive realistic faces, detailed hair and eyes, sophisticated cel shading, beautiful environmental detail',
      'Fairytale Animation':'premium modern fairytale animated-film illustration, richly detailed painterly characters, expressive faces, soft cinematic lighting, magical but believable environment',
      '3D Cartoon':'high-end 3D animated feature film character render, realistic materials, detailed hair and clothing, expressive natural faces, cinematic studio lighting, polished depth and texture',
      'Comic Book':'premium graphic-novel illustration, anatomically believable characters, detailed ink linework, controlled comic shading, rich painted colour, dramatic cinematic composition',
      'Chibi':'premium chibi character illustration with deliberately cute proportions, large expressive eyes, detailed hair and clothing, polished professional digital painting, charming background',
      'Watercolour':'high-end editorial watercolour portrait, recognisable realistic human features, delicate layered washes, visible paper texture, fine brush detail, natural light and elegant composition',
      'Pencil Illustration':'highly detailed graphite pencil illustration, realistic facial structure, individual hair strokes, realistic shading, fine paper texture and professional atelier finish',
      'Pop Art':'premium contemporary pop-art portrait, recognisable realistic face and anatomy, bold graphic colour blocking, crisp halftone texture, strong composition and gallery-quality finish'
    };
    const scenePrompts = {
      'Keep original':'keep the original environment and overall setting recognisable',
      'Beach':'a beautiful sunny family beach setting with natural poses and interaction',
      'Christmas':'a warm festive Christmas setting with a decorated tree, tasteful lights and natural family interaction',
      'Football':'a lively football stadium environment, with natural football-related poses and believable scale',
      'Birthday':'a joyful birthday celebration with tasteful decorations, cake and natural interaction',
      'Travel':'a picturesque travel destination with cinematic environmental detail and natural interaction',
      'Banquet':'a grand elegant banquet hall with a long beautifully dressed table, varied seating and standing positions, warm candlelight and rich environmental detail',
      'Medieval Castle':'a grand medieval castle hall with believable period surroundings and varied natural poses',
      'Wedding':'an elegant wedding celebration with a beautiful venue and natural varied family interaction',
      'Ski Resort':'a picturesque snowy ski resort with winter clothing, varied poses and natural interaction',
      'Birthday Party':'a lively family birthday party with decorations, presents and varied natural poses',
      'Custom':'a completely new environment composed naturally around the people'
    };
    if (isExample) {
      if (!style) return res.status(400).json({ error: 'Please provide a style.' });
      const prompt = `Create a realistic, professional style-reference portrait for a personalised art website. ${stylePrompts[style] || style}. Show one adult person from the chest up, neutral friendly expression, simple uncluttered background, front three-quarter view, natural proportions, no text, no logos, no watermark. The image must clearly demonstrate the named visual style rather than being a generic cartoon or simple line drawing.`;
      const response = await fetch('https://api.openai.com/v1/images/generations', { method:'POST', headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'}, body:JSON.stringify({model:'gpt-image-2',prompt,size:'1024x1024',quality:'low',output_format:'jpeg'}) });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error:data?.error?.message || 'Example generation failed.' });
      const result=data?.data?.[0];
      if(!result?.b64_json) return res.status(502).json({error:'The image service returned no example.'});
      return res.status(200).json({image:`data:image/jpeg;base64,${result.b64_json}`,mode});
    }
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) return res.status(400).json({ error:'Please provide a valid artwork image.' });
    if (isRoom && (!roomImage || !roomImage.startsWith('data:image/'))) return res.status(400).json({ error:'Please provide a valid room image.' });

    const sourceInstruction = creationMode === 'scene'
      ? `Treat the supplied photograph primarily as an identity and appearance reference, NOT as a composition to copy. First identify every distinct person in the reference. Preserve the correct number of people. Preserve each person's individual facial characteristics, hair, approximate age, body proportions, skin tone, glasses and other distinctive features. Keep people separate and do not merge faces or bodies. Then completely redesign the composition for the requested scene. Do NOT preserve the source photograph's seating arrangement, poses, camera positions, body orientations, spacing or cropping. Reposition every person independently into natural scene-appropriate poses, with believable interactions and depth. People may stand, sit, walk, lean, interact with objects or animals, or occupy different parts of the scene. The final image should look as though these same people were originally photographed or illustrated in the new scene.`
      : `Treat the supplied photograph as the main composition reference. Preserve every distinct person, the correct number of people, their individual identity, facial characteristics, hair, approximate body proportions and important clothing details. Keep people separate and do not merge faces or bodies. Apply the requested visual style consistently to the whole group.`;

    const sceneInstruction = scenePrompts[scene] || scene || 'a completely new natural environment';
    const prompt = isRoom
      ? 'Use the supplied room photo as the exact environment. Place the supplied finished artwork as a printed picture inside a simple standard black frame on an appropriate visible wall. Keep the room, furniture, architecture, lighting and perspective realistic and recognisable. Make the framed print look naturally photographed in the room, with realistic scale, perspective, shadows and reflections. Do not alter the artwork itself. Do not add people, text, logos or watermarks. The black frame is only a visualisation aid and is not part of the purchase.'
      : `${isFinal ? 'Create the final high-quality personalised artwork suitable for professional printing.' : 'Create a lightweight personalised preview.'} Visual style: ${stylePrompts[style] || style || 'premium illustrated portrait'}. Requested scene: ${sceneInstruction}. ${sourceInstruction} ${creationMode === 'scene' ? 'Composition is especially important: create a fresh, varied arrangement with different heights, poses, activities and positions rather than a lift-and-shift of the source image. For example, in a banquet scene a four-person family could naturally be distributed around the room, with one person standing at the head of the table, another interacting with a dog, and two seated at the table. These are example composition roles, not mandatory identities; assign roles naturally while keeping every original person present.' : ''} Do not add or remove people. Do not add text, logos or watermarks. ${creationMode === 'scene' ? 'Make the selected environment feel fully authentic and integrated, with correct perspective, lighting, shadows and interactions.' : 'Prioritise clear communication of the selected style.'} ${isFinal ? 'Make it polished and print-ready.' : 'Keep the preview lightweight.'}`;

    const parseImage=(dataUrl)=>{const [meta,encoded]=dataUrl.split(',',2);const m=meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);if(!m||!encoded)throw new Error('Invalid image data.');return{buffer:Buffer.from(encoded,'base64'),mime:m[1]};};
    const artwork=parseImage(image); const form=new FormData(); form.append('model','gpt-image-2'); form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),`artwork.${artwork.mime.split('/')[1]}`);
    if(isRoom){const room=parseImage(roomImage);form.append('image[]',new Blob([room.buffer],{type:room.mime}),`room.${room.mime.split('/')[1]}`);}
    form.append('prompt',prompt); form.append('size','1024x1024'); form.append('quality',isFinal?'high':'low'); form.append('output_format','png');
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form}); const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Image generation failed.'});
    const result=data?.data?.[0]; if(!result?.b64_json)return res.status(502).json({error:'The image service returned no image.'});
    return res.status(200).json({image:`data:image/png;base64,${result.b64_json}`,mode});
  } catch(error){console.error('Generation error:',error);return res.status(500).json({error:error.message||'Something went wrong while creating the image.'});}
}