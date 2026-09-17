export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  try {
    const { image, roomImage, style, scene, mode = 'preview', creationMode = 'transform', personCount = null, petCount = 0 } = req.body || {};
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
      'Banquet':'a grand elegant banquet hall with a long beautifully dressed table, warm candlelight and rich environmental detail',
      'Medieval Castle':'a grand medieval castle hall with believable period surroundings and varied natural poses',
      'Wedding':'an elegant wedding celebration with a beautiful venue and natural varied family interaction',
      'Ski Resort':'a picturesque snowy ski resort with winter clothing, varied poses and natural interaction',
      'Birthday Party':'a lively family birthday party with decorations, presents and varied natural poses',
      'Custom':'a completely new environment composed naturally around the people'
    };
    const fixedScenes = {
      'Grand Banquet': {
        roles:{1:['standing at the head of the banquet table'],2:['standing at the head of the banquet table','seated naturally at the table'],3:['standing at the head of the banquet table','seated naturally at the table','standing beside the table in a natural conversational pose'],4:['standing at the head of the banquet table','seated naturally on the left side of the table','seated naturally on the right side of the table','standing beside the table in a natural conversational pose'],5:['standing at the head of the banquet table','seated naturally on the left side of the table','seated naturally on the right side of the table','seated further along the table','standing beside the table in a natural conversational pose']},
        pet:'If a real uploaded pet is selected, place that pet in a predefined floor-level position beside the table; otherwise do not add any animal.'
      },
      'Christmas Morning': {
        roles:{1:['standing beside the Christmas tree opening a present'],2:['kneeling beside the Christmas tree with a present','standing nearby holding a present'],3:['kneeling beside the tree','sitting on the floor opening a present','standing beside the tree'],4:['kneeling beside the tree','sitting on the floor opening a present','sitting near the presents','standing beside the tree'],5:['kneeling beside the tree','sitting on the floor opening a present','sitting near the presents','standing beside the tree','standing near the fireplace holding a present']},
        pet:'If a real uploaded pet is selected, place it naturally beside the Christmas tree or presents; otherwise do not add an animal.'
      },
      'Football Stadium': {
        roles:{1:['standing pitch-side in the stadium'],2:['standing pitch-side','sitting in the front row'],3:['standing pitch-side','sitting in the front row','standing beside the advertising boards'],4:['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps'],5:['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps','standing near the tunnel entrance']},
        pet:'If a real uploaded pet is selected, place it only in a safe spectator area; otherwise do not add an animal.'
      },
      'Tropical Holiday': {
        roles:{1:['standing beside the shoreline'],2:['standing beside the shoreline','sitting on a beach lounger'],3:['standing beside the shoreline','sitting on a beach lounger','walking near the water'],4:['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol'],5:['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol','standing near tropical plants']},
        pet:'If a real uploaded pet is selected, place it naturally near its owner in a safe beach area; otherwise do not add an animal.'
      },
      'Enchanted Castle': {
        roles:{1:['standing in the grand castle hall'],2:['standing on the grand staircase','standing in the castle hall'],3:['standing on the grand staircase','standing beside a window','standing in the castle hall'],4:['standing on the grand staircase','standing beside a window','standing beside a castle table','standing in the castle hall'],5:['standing on the grand staircase','standing beside a window','standing beside a castle table','standing near the fireplace','standing in the castle hall']},
        pet:'If a real uploaded pet is selected, place it naturally beside its owner; otherwise do not add an animal.'
      },
      'Birthday Party': {
        roles:{1:['standing beside the birthday cake'],2:['standing beside the birthday cake','sitting near the presents'],3:['standing beside the birthday cake','sitting near the presents','standing beside the decorations'],4:['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations'],5:['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations','standing near the party table']},
        pet:'If a real uploaded pet is selected, place it naturally near the party table; otherwise do not add an animal.'
      },
      'Camping Adventure': {
        roles:{1:['standing beside the campfire'],2:['standing beside the tent','sitting beside the campfire'],3:['standing beside the tent','sitting beside the campfire','walking beside the campsite'],4:['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite'],5:['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite','standing beside the picnic table']},
        pet:'If a real uploaded pet is selected, place it naturally beside the campsite; otherwise do not add an animal.'
      },
      'Ski Holiday': {
        roles:{1:['standing on the snowy slope'],2:['standing on the snowy slope','sitting at the ski lodge'],3:['standing on the snowy slope','sitting at the ski lodge','walking near the lift'],4:['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut'],5:['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut','standing beside the piste']},
        pet:'If a real uploaded pet is selected, place it safely beside the ski lodge; otherwise do not add an animal.'
      }
    };
    const styleScenes={
      'Anime':['Grand Banquet','Christmas Morning','Football Stadium','Tropical Holiday','Enchanted Castle','Birthday Party','Camping Adventure','Ski Holiday'],
      'Fairytale Animation':['Grand Banquet','Christmas Morning','Enchanted Castle','Birthday Party','Camping Adventure','Tropical Holiday','Ski Holiday'],
      '3D Cartoon':['Grand Banquet','Christmas Morning','Football Stadium','Tropical Holiday','Enchanted Castle','Birthday Party','Camping Adventure','Ski Holiday'],
      'Comic Book':['Grand Banquet','Football Stadium','Enchanted Castle','Birthday Party','Camping Adventure','Ski Holiday','Tropical Holiday'],
      'Chibi':['Grand Banquet','Christmas Morning','Birthday Party','Camping Adventure','Tropical Holiday','Enchanted Castle'],
      'Watercolour':['Grand Banquet','Christmas Morning','Tropical Holiday','Birthday Party','Camping Adventure','Enchanted Castle'],
      'Pencil Illustration':['Grand Banquet','Christmas Morning','Enchanted Castle','Wedding','Tropical Holiday','Camping Adventure'],
      'Pop Art':['Grand Banquet','Birthday Party','Football Stadium','Tropical Holiday','Christmas Morning','Enchanted Castle']
    };
    if (isExample) {
      if (!style) return res.status(400).json({ error:'Please provide a style.' });
      const prompt=`Create a realistic, professional style-reference portrait for a personalised art website. ${stylePrompts[style]||style}. Show one adult person from the chest up, neutral friendly expression, simple uncluttered background, front three-quarter view, natural proportions, no text, no logos, no watermark. The image must clearly demonstrate the named visual style rather than being a generic cartoon or simple line drawing.`;
      const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-2',prompt,size:'1024x1024',quality:'low',output_format:'jpeg'})});
      const data=await response.json();
      if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Example generation failed.'});
      const result=data?.data?.[0]; if(!result?.b64_json)return res.status(502).json({error:'The image service returned no example.'});
      return res.status(200).json({image:`data:image/jpeg;base64,${result.b64_json}`,mode});
    }
    if(!image||typeof image!=='string'||!image.startsWith('data:image/'))return res.status(400).json({error:'Please provide a valid artwork image.'});
    if(isRoom&&(!roomImage||!roomImage.startsWith('data:image/')))return res.status(400).json({error:'Please provide a valid room image.'});

    const fixedScene=creationMode==='scene'?fixedScenes[scene]:null;
    let sceneInstruction=scenePrompts[scene]||scene||'a completely new natural environment';
    if(creationMode==='scene'){
      if(!fixedScene)return res.status(400).json({error:'Please choose a standard scene.'});
      const count=Number(personCount);
      if(!Number.isInteger(count)||count<1||count>5)return res.status(400).json({error:'Please select a people count from 1 to 5 for a standard scene.'});
      const roles=fixedScene.roles[count];
      if(!roles)return res.status(400).json({error:'That scene does not have this people-count variant yet.'});
      sceneInstruction=`${scene}. Use the approved ${count}-person composition exactly as defined. Character slots are: ${roles.map((r,i)=>`slot ${i+1}: ${r}`).join('; ')}. Keep these positions and actions consistent between customers. ${fixedScene.pet} Do not invent any additional person or animal.`;
    }

    const sourceInstruction=creationMode==='scene'
      ? `Treat the supplied photograph primarily as an identity/reference source, NOT as a composition to copy. Identify every distinct person and any real pets present. Preserve the correct selected number of people and only the selected real pets. Preserve each person's individual facial characteristics, hair, approximate age, body proportions, skin tone, glasses and other distinctive features. Preserve each selected pet's recognisable face, markings, colouring, size and body characteristics. Keep every identity separate and do not merge faces or bodies. Create the customer avatars in the requested visual style first, conceptually, then place those avatars into the approved scene composition. Discard the source photograph's seating arrangement, poses, camera positions, body orientations, spacing and cropping. Recompose each identity independently into the predefined role slot. The final image should look as though these same people and pets naturally belong in the new scene.`
      : `Treat the supplied photograph as the main composition reference. Preserve every distinct person, the correct number of people, their individual identity, facial characteristics, hair, approximate body proportions and important clothing details. Keep people separate and do not merge faces or bodies. Apply the requested visual style consistently to the whole group.`;

    const prompt=isRoom
      ? 'Use the supplied room photo as the exact environment. Place the supplied finished artwork as a printed picture inside a simple standard black frame on an appropriate visible wall. Keep the room, furniture, architecture, lighting and perspective realistic and recognisable. Make the framed print look naturally photographed in the room, with realistic scale, perspective, shadows and reflections. Do not alter the artwork itself. Do not add people, animals, text, logos or watermarks. The black frame is only a visualisation aid and is not part of the purchase.'
      : `${isFinal?'Create the final high-quality personalised artwork suitable for professional printing.':'Create a lightweight personalised preview.'} Visual style: ${stylePrompts[style]||style||'premium illustrated portrait'}. Requested scene: ${sceneInstruction}. ${sourceInstruction} ${creationMode==='scene'?'Composition is fixed for this scene and people count. Do not randomly redesign the layout. Preserve the defined role slots while varying only natural facial expression, small hand/pose details and rendering. Never add an animal unless a real pet was supplied and selected. Never add an extra person. Never remove a supplied person.':''} Do not add text, logos or watermarks. ${creationMode==='scene'?'Make the selected environment feel fully authentic and integrated, with correct perspective, lighting, shadows and interactions.':'Prioritise clear communication of the selected style.'} ${isFinal?'Make it polished and print-ready.':'Keep the preview lightweight.'}`;

    const parseImage=dataUrl=>{const [meta,encoded]=dataUrl.split(',',2);const m=meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);if(!m||!encoded)throw new Error('Invalid image data.');return{buffer:Buffer.from(encoded,'base64'),mime:m[1]};};
    const artwork=parseImage(image); const form=new FormData(); form.append('model','gpt-image-2'); form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),`artwork.${artwork.mime.split('/')[1]}`);
    if(isRoom){const room=parseImage(roomImage);form.append('image[]',new Blob([room.buffer],{type:room.mime}),`room.${room.mime.split('/')[1]}`);}
    form.append('prompt',prompt); form.append('size','1024x1024'); form.append('quality',isFinal?'high':'low'); form.append('output_format','png');
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form}); const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Image generation failed.'});
    const result=data?.data?.[0]; if(!result?.b64_json)return res.status(502).json({error:'The image service returned no image.'});
    return res.status(200).json({image:`data:image/png;base64,${result.b64_json}`,mode,sceneTemplate:creationMode==='scene'?scene:null,personCount:creationMode==='scene'?Number(personCount):null,petCount:creationMode==='scene'?Number(petCount)||0:0});
  } catch(error){console.error('Generation error:',error);return res.status(500).json({error:error.message||'Something went wrong while creating the image.'});}
}
