export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  try {
    const body = req.body || {};
    const { image, avatarImage, roomImage, style, scene, setting = 'Default', mode = 'preview', personCount, adjustments = '' } = body;
    const styles = {
      'Anime':'cinematic Japanese anime illustration, polished feature-film quality, expressive faces, detailed hair and eyes, sophisticated cel shading',
      'Fairytale Animation':'premium modern fairytale animated-film illustration, richly detailed painterly characters, expressive faces, soft cinematic lighting',
      '3D Cartoon':'high-end 3D animated feature-film character render, realistic materials, detailed hair and clothing, expressive natural faces, cinematic lighting',
      'Comic Book':'premium graphic-novel illustration, believable anatomy, detailed ink linework, controlled comic shading, rich painted colour',
      'Chibi':'premium chibi character illustration, cute proportions, large expressive eyes, detailed hair and clothing, polished digital painting',
      'Watercolour':'high-end editorial watercolour portrait, recognisable realistic features, delicate layered washes, paper texture, fine brush detail',
      'Pencil Illustration':'highly detailed graphite pencil illustration, realistic facial structure, individual hair strokes, fine shading and paper texture',
      'Pop Art':'premium contemporary pop-art portrait, recognisable face and anatomy, bold graphic colour blocking, crisp halftone texture'
    };
    const fixedScenes = {
      'Grand Banquet':['standing at the head of the banquet table','seated on the left side of the table','seated on the right side of the table','seated further along the table','standing beside the table'],
      'Christmas Morning':['kneeling beside the tree with a present','sitting on the floor opening a present','sitting near the presents','standing beside the tree','standing near the fireplace'],
      'Football Stadium':['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps','standing near the tunnel entrance'],
      'Tropical Holiday':['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol','standing near tropical plants'],
      'Enchanted Castle':['standing on the grand staircase','standing beside a window','standing beside a castle table','standing near the fireplace','standing in the hall'],
      'Birthday Party':['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations','standing near the party table'],
      'Camping Adventure':['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite','standing beside the picnic table'],
      'Ski Holiday':['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut','standing beside the piste']
    };
    const sceneAliases={'Banquet':'Grand Banquet','Christmas':'Christmas Morning','Football':'Football Stadium','Beach':'Tropical Holiday','Birthday':'Birthday Party','Ski Resort':'Ski Holiday','Medieval Castle':'Enchanted Castle'};
    const canonicalScene=sceneAliases[scene]||scene;
    const parseImage=dataUrl=>{const [meta,encoded]=String(dataUrl||'').split(',',2);const m=meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);if(!m||!encoded)throw new Error('Invalid image data.');return{buffer:Buffer.from(encoded,'base64'),mime:m[1]};};
    const textFromResponse=data=>{if(typeof data?.output_text==='string')return data.output_text;const texts=[];for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')texts.push(c.text);return texts.join('\n');};

    if(mode==='analyse'){
      if(!image)return res.status(400).json({error:'Please provide a photo.'});
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content:[{type:'input_text',text:'Analyse this customer photo for a personalised illustration. Count distinct people who are actually visible and real pets. Do not invent anyone. Return ONLY JSON: {"people":number,"pets":number,"notes":"brief neutral identity description"}. Count children and adults. Count a mirror/reflection only once.'},{type:'input_image',image_url:image}]}],max_output_tokens:300})});
      const data=await response.json();if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Photo analysis failed.'});
      let parsed;try{parsed=JSON.parse(textFromResponse(data).replace(/```json|```/g,'').trim())}catch{parsed={people:1,pets:0,notes:'Please confirm the detected people count.'};}
      return res.status(200).json({people:Math.max(1,Math.min(5,Number(parsed.people)||1)),pets:Math.max(0,Number(parsed.pets)||0),notes:String(parsed.notes||'')});
    }

    if(!image||!style)return res.status(400).json({error:'Please provide a photo and style.'});
    const count=Math.max(1,Math.min(5,Number(personCount)||1));
    if(mode==='avatars'){
      const prompt=`Create a clean approval sheet of exactly ${count} distinct personalised character avatars from the supplied customer photo. Visual style: ${styles[style]||style}. The source photo is identity reference only, not composition. Preserve each person's face, hair, skin tone, approximate age, body proportions, glasses and distinctive features. Keep identities separate and in the same left-to-right order as practical. Use consistent chest-up or waist-up portraits on a simple neutral background. ${adjustments?`Customer instruction: ${adjustments}`:''} Do not invent people or animals. No text, logos or watermarks.`;
      const artwork=parseImage(image),form=new FormData();form.append('model','gpt-image-2');form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),'source.png');form.append('prompt',prompt);form.append('size','1024x1024');form.append('quality','low');form.append('output_format','png');
      const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form});const data=await response.json();if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Avatar generation failed.'});const result=data?.data?.[0];if(!result?.b64_json)return res.status(502).json({error:'The image service returned no avatar sheet.'});
      return res.status(200).json({image:`data:image/png;base64,${result.b64_json}`,people:count,mode});
    }
    if(mode==='room'){
      if(!roomImage)return res.status(400).json({error:'Please provide a room image.'});
      const artwork=parseImage(image),room=parseImage(roomImage),form=new FormData();form.append('model','gpt-image-2');form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),'artwork.png');form.append('image[]',new Blob([room.buffer],{type:room.mime}),'room.png');form.append('prompt','Use the supplied room photo as the exact environment. Place the supplied finished artwork as a printed picture inside a simple standard black frame on an appropriate visible wall. Keep the room, furniture, architecture, lighting and perspective realistic. Do not alter the artwork. Do not add people, animals, text, logos or watermarks.');form.append('size','1024x1024');form.append('quality','low');form.append('output_format','png');
      const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form});const data=await response.json();if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Visualisation failed.'});return res.status(200).json({image:`data:image/png;base64,${data.data?.[0]?.b64_json}`,mode});
    }
    if(!fixedScenes[canonicalScene])return res.status(400).json({error:'Please choose an approved standard scene.'});
    const roles=fixedScenes[canonicalScene].slice(0,count);
    const outfitMap={'Classic Formal':'tailored formalwear appropriate to each person','Royal':'formal royal banquet clothing, eveningwear and tasteful ceremonial accessories','Gangster':'period-inspired tailored gangster styling with dark suits, shirts and ties, age-appropriate for children','Modern Luxury':'polished contemporary luxury eveningwear and refined accessories','Fantasy':'tasteful fantasy ceremonial clothing appropriate to each age','Traditional':'classic festive winter clothing','Cosy':'warm cosy knitwear and winter layers','Elegant':'refined winter party clothing','Winter Wonderland':'magical winter coats, scarves and tasteful snow-themed accessories','Match Day':'modern football supporter clothing with no visible team logos','Retro':'vintage-inspired football clothing with no visible team logos','Championship':'smart contemporary match-day clothing with sporty accessories','Streetwear':'modern casual streetwear, hoodies and trainers','Resort':'stylish warm-weather resort clothing','Beach Casual':'relaxed beach clothing and sandals','Adventure':'practical holiday adventure clothing','Sunset Luxury':'elevated resort eveningwear','Royal Court':'formal aristocratic court clothing with tasteful ceremonial accessories','Medieval':'historically inspired medieval clothing without weapons','Dark Fantasy':'dramatic but family-appropriate fantasy clothing','Fairytale':'whimsical fairytale clothing','Classic':'polished birthday-party clothing','Fun Party':'colourful contemporary party clothing','Explorer':'practical outdoor explorer clothing','Woodland':'comfortable woodland layers and boots','Alpine':'stylish alpine ski clothing','Luxury Lodge':'refined winter resort clothing','Retro Ski':'vintage-inspired ski clothing'};
    const settingText=setting!=='Default'?`Setting/look: ${setting}. Change clothing, footwear and accessories only: ${outfitMap[setting]||setting}. Preserve identity exactly and keep children age-appropriate.`:'';
    const avatarText=avatarImage?' A generated customer avatar sheet is also supplied. Treat it as a canonical identity/style reference for the people; do not merge identities.':'';
    const prompt=`${mode==='final'?'Create the final high-quality personalised artwork suitable for professional printing.':'Create a lightweight visual preview.'} Visual style: ${styles[style]||style}. Standard scene: ${canonicalScene}. EXACTLY ${count} PEOPLE. Fixed roles: ${roles.map((r,i)=>`slot ${i+1}: ${r}`).join('; ')}. Keep these positions and camera composition consistent between customers. ${settingText}${avatarText} Treat the original photo as identity reference, not composition. Discard its seating, poses, camera position, body orientation, spacing and cropping. Preserve each supplied person's facial characteristics, hair, approximate age, skin tone, body proportions, glasses and distinctive features. Never invent an extra person or remove one. Never add an animal unless the customer instruction explicitly requests a real pet from the source photo. ${adjustments?`Customer instruction: ${adjustments}`:''} No text, logos or watermarks.`;
    const artwork=parseImage(image),form=new FormData();form.append('model','gpt-image-2');form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),'source.png');if(avatarImage){const av=parseImage(avatarImage);form.append('image[]',new Blob([av.buffer],{type:av.mime}),'avatars.png');}form.append('prompt',prompt);form.append('size','1024x1024');form.append('quality',mode==='final'?'high':'low');form.append('output_format','png');
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form});const data=await response.json();if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Image generation failed.'});const result=data?.data?.[0];if(!result?.b64_json)return res.status(502).json({error:'The image service returned no image.'});
    return res.status(200).json({image:`data:image/png;base64,${result.b64_json}`,mode,people:count,scene:canonicalScene});
  }catch(error){console.error('Generation error:',error);return res.status(500).json({error:error.message||'Something went wrong while creating the image.'});}
}
