export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  try {
    const { image, roomImage, style, scene, setting = 'Default', mode = 'preview', creationMode = 'transform', personCount = 4, petCount = 0 } = req.body || {};
    const isExample = mode === 'example', isRoom = mode === 'room', isFinal = mode === 'final';
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
    const aliases={'Banquet':'Grand Banquet','Christmas':'Christmas Morning','Football':'Football Stadium','Beach':'Tropical Holiday','Birthday':'Birthday Party','Ski Resort':'Ski Holiday','Medieval Castle':'Enchanted Castle'};
    const fixedScenes={
      'Grand Banquet':{roles:{1:['standing at the head of the banquet table'],2:['standing at the head of the banquet table','seated naturally at the table'],3:['standing at the head of the banquet table','seated naturally at the table','standing beside the table'],4:['standing at the head of the banquet table','seated on the left side of the table','seated on the right side of the table','standing beside the table'],5:['standing at the head of the banquet table','seated on the left side of the table','seated on the right side of the table','seated further along the table','standing beside the table']},pet:'If a real uploaded pet is selected, place that pet in a predefined position beside the table; otherwise do not add any animal.'},
      'Christmas Morning':{roles:{1:['standing beside the Christmas tree opening a present'],2:['kneeling beside the tree with a present','standing nearby holding a present'],3:['kneeling beside the tree','sitting on the floor opening a present','standing beside the tree'],4:['kneeling beside the tree','sitting on the floor opening a present','sitting near the presents','standing beside the tree'],5:['kneeling beside the tree','sitting on the floor opening a present','sitting near the presents','standing beside the tree','standing near the fireplace']},pet:'If a real uploaded pet is selected, place it naturally beside the tree or presents; otherwise do not add an animal.'},
      'Football Stadium':{roles:{1:['standing pitch-side'],2:['standing pitch-side','sitting in the front row'],3:['standing pitch-side','sitting in the front row','standing beside the advertising boards'],4:['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps'],5:['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps','standing near the tunnel entrance']},pet:'If a real uploaded pet is selected, place it only in a safe spectator area; otherwise do not add an animal.'},
      'Tropical Holiday':{roles:{1:['standing beside the shoreline'],2:['standing beside the shoreline','sitting on a beach lounger'],3:['standing beside the shoreline','sitting on a beach lounger','walking near the water'],4:['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol'],5:['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol','standing near tropical plants']},pet:'If a real uploaded pet is selected, place it naturally near its owner; otherwise do not add an animal.'},
      'Enchanted Castle':{roles:{1:['standing in the grand castle hall'],2:['standing on the grand staircase','standing in the castle hall'],3:['standing on the grand staircase','standing beside a window','standing in the castle hall'],4:['standing on the grand staircase','standing beside a window','standing beside a castle table','standing in the hall'],5:['standing on the grand staircase','standing beside a window','standing beside a castle table','standing near the fireplace','standing in the hall']},pet:'If a real uploaded pet is selected, place it naturally beside its owner; otherwise do not add an animal.'},
      'Birthday Party':{roles:{1:['standing beside the birthday cake'],2:['standing beside the birthday cake','sitting near the presents'],3:['standing beside the birthday cake','sitting near the presents','standing beside the decorations'],4:['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations'],5:['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations','standing near the party table']},pet:'If a real uploaded pet is selected, place it naturally near the party table; otherwise do not add an animal.'},
      'Camping Adventure':{roles:{1:['standing beside the campfire'],2:['standing beside the tent','sitting beside the campfire'],3:['standing beside the tent','sitting beside the campfire','walking beside the campsite'],4:['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite'],5:['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite','standing beside the picnic table']},pet:'If a real uploaded pet is selected, place it naturally beside the campsite; otherwise do not add an animal.'},
      'Ski Holiday':{roles:{1:['standing on the snowy slope'],2:['standing on the snowy slope','sitting at the ski lodge'],3:['standing on the snowy slope','sitting at the ski lodge','walking near the lift'],4:['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut'],5:['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut','standing beside the piste']},pet:'If a real uploaded pet is selected, place it safely beside the ski lodge; otherwise do not add an animal.'}
    };
    if(isExample){
      if(!style)return res.status(400).json({error:'Please provide a style.'});
      const prompt=`Create a realistic, professional style-reference portrait for a personalised art website. ${stylePrompts[style]||style}. Show one adult person from the chest up, neutral friendly expression, simple uncluttered background, front three-quarter view, natural proportions, no text, logos or watermark.`;
      const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-2',prompt,size:'1024x1024',quality:'low',output_format:'jpeg'})});
      const data=await response.json(); if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Example generation failed.'});
      const result=data?.data?.[0]; if(!result?.b64_json)return res.status(502).json({error:'The image service returned no example.'});
      return res.status(200).json({image:`data:image/jpeg;base64,${result.b64_json}`,mode});
    }
    if(!image||typeof image!=='string'||!image.startsWith('data:image/'))return res.status(400).json({error:'Please provide a valid artwork image.'});
    if(isRoom&&(!roomImage||!roomImage.startsWith('data:image/')))return res.status(400).json({error:'Please provide a valid room image.'});
    const canonicalScene=aliases[scene]||scene;
    const fixedScene=creationMode==='scene'?fixedScenes[canonicalScene]:null;
    let sceneInstruction=canonicalScene||'a natural environment';
    if(creationMode==='scene'){
      if(!fixedScene)return res.status(400).json({error:'Please choose a standard scene.'});
      const count=Number(personCount); if(!Number.isInteger(count)||count<1||count>5)return res.status(400).json({error:'Please select 1 to 5 people.'});
      const roles=fixedScene.roles[count]; if(!roles)return res.status(400).json({error:'That scene does not have this people-count variant yet.'});
      sceneInstruction=`${canonicalScene}. APPROVED FIXED ${count}-PERSON COMPOSITION. Slot 1: ${roles[0]}.${roles.slice(1).map((r,i)=>` Slot ${i+2}: ${r}.`).join('')} Keep these positions consistent between customers. ${fixedScene.pet} Never invent an additional person or animal.`;
    }
    const approvedSettings={
      'Grand Banquet':['Classic Formal','Royal','Gangster','Modern Luxury','Fantasy'],
      'Christmas Morning':['Traditional','Cosy','Elegant','Winter Wonderland'],
      'Football Stadium':['Match Day','Retro','Championship','Streetwear'],
      'Tropical Holiday':['Resort','Beach Casual','Adventure','Sunset Luxury'],
      'Enchanted Castle':['Royal Court','Medieval','Dark Fantasy','Fairytale'],
      'Birthday Party':['Classic','Elegant','Fun Party','Fantasy'],
      'Camping Adventure':['Explorer','Woodland','Cosy','Adventure'],
      'Ski Holiday':['Alpine','Luxury Lodge','Adventure','Retro Ski']
    };
    let settingInstruction='';
    if(creationMode==='scene'){
      const options=approvedSettings[canonicalScene]||[];
      if(!options.includes(setting))return res.status(400).json({error:'Please choose an approved setting for this scene.'});
      const outfitMap={
        'Classic Formal':'tailored formalwear appropriate to each person, with elegant evening styling',
        'Royal':'formal royal banquet clothing appropriate to each person's age, such as tuxedos, evening dresses, tasteful crowns or ceremonial accessories',
        'Gangster':'period-inspired tailored gangster styling, dark suits, shirts, ties and understated accessories, age-appropriate for children',
        'Modern Luxury':'polished contemporary luxury eveningwear, smart tailoring and refined accessories',
        'Fantasy':'tasteful fantasy ceremonial clothing and accessories appropriate to each person's age',
        'Traditional':'classic festive winter clothing with tasteful traditional Christmas details',
        'Cosy':'warm cosy knitwear, winter layers and comfortable festive clothing',
        'Elegant':'refined winter party clothing with polished festive accessories',
        'Winter Wonderland':'magical winter clothing, scarves, coats and tasteful snow-themed accessories',
        'Match Day':'modern football supporter clothing appropriate to each person's age, with no visible team logos',
        'Retro':'vintage-inspired football-era clothing appropriate to each person's age, with no visible team logos',
        'Championship':'smart contemporary match-day clothing and sporty accessories, with no visible team logos',
        'Streetwear':'modern casual streetwear, hoodies, trainers and coordinated layers appropriate to each person's age',
        'Resort':'stylish warm-weather resort clothing appropriate to each person's age',
        'Beach Casual':'relaxed beach clothing, sandals and light summer layers appropriate to each person's age',
        'Adventure':'practical holiday adventure clothing, comfortable footwear and light outdoor layers',
        'Sunset Luxury':'elevated resort eveningwear appropriate to each person's age, with refined accessories',
        'Royal Court':'formal aristocratic court clothing appropriate to each person's age, with tasteful ceremonial accessories',
        'Medieval':'historically inspired medieval clothing appropriate to each person's age, without weapons',
        'Dark Fantasy':'dramatic but family-appropriate fantasy clothing in darker tones, with tasteful accessories',
        'Fairytale':'whimsical fairytale clothing and tasteful accessories appropriate to each person's age',
        'Classic':'polished birthday-party clothing appropriate to each person's age',
        'Fun Party':'colourful contemporary party clothing appropriate to each person's age',
        'Fantasy':'tasteful fantasy celebration clothing appropriate to each person's age',
        'Explorer':'practical outdoor explorer clothing appropriate to each person's age',
        'Woodland':'comfortable woodland layers, boots and nature-inspired colours',
        'Adventure':'practical family adventure clothing appropriate to each person's age',
        'Alpine':'stylish alpine ski clothing, coats, hats and appropriate footwear',
        'Luxury Lodge':'refined winter resort clothing appropriate to each person's age',
        'Adventure':'practical snow-sport holiday clothing appropriate to each person's age',
        'Retro Ski':'vintage-inspired ski clothing appropriate to each person's age'
      };
      settingInstruction=`SETTING / LOOK: ${setting}. Change clothing, footwear and tasteful accessories to match this setting: ${outfitMap[setting]||'a coherent age-appropriate outfit for this setting'}. This changes the avatars' styling, not their identity. Preserve every person's face, hair, skin tone, approximate age, body proportions, glasses and distinctive features. Keep children age-appropriate. Do not use visible brand or team logos. Pets keep their real identity and normal appearance unless a subtle setting-appropriate accessory is explicitly needed.`;
    }
    const sourceInstruction=creationMode==='scene'
      ? `Treat the supplied photo as an identity/reference source, NOT as a composition to copy. Identify every distinct person and any real pets. Preserve each person's facial characteristics, hair, approximate age, body proportions, skin tone, glasses and distinctive features. Preserve each selected pet's recognisable face, markings, colouring, size and body characteristics. Keep every identity separate. Conceptually create the customer avatars in the requested style first, then place those avatars into the approved scene slots. Discard the source photo's seating arrangement, poses, camera positions, body orientations, spacing and cropping.`
      : `Treat the supplied photograph as the main composition reference. Preserve every distinct person, their individual identity, facial characteristics, hair, approximate body proportions and important clothing details. Keep people separate and do not merge faces or bodies.`;
    const prompt=isRoom
      ? 'Use the supplied room photo as the exact environment. Place the supplied finished artwork as a printed picture inside a simple standard black frame on an appropriate visible wall. Keep the room, furniture, architecture, lighting and perspective realistic. Do not alter the artwork. Do not add people, animals, text, logos or watermarks. The black frame is only a visualisation aid and is not part of the purchase.'
      : `${isFinal?'Create the final high-quality personalised artwork suitable for professional printing.':'Create a lightweight personalised preview.'} Visual style: ${stylePrompts[style]||style||'premium illustrated portrait'}. Scene: ${sceneInstruction}. ${settingInstruction} ${sourceInstruction} ${creationMode==='scene'?'Composition is fixed for this scene and people count. Do not randomly redesign the layout. Preserve every defined role slot. Never add an animal unless a real pet was supplied and selected. Never add an extra person or remove a supplied person.':''} Do not add text, logos or watermarks. ${isFinal?'Make it polished and print-ready.':'Keep the preview lightweight.'}`;
    const parseImage=dataUrl=>{const [meta,encoded]=dataUrl.split(',',2);const m=meta.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/);if(!m||!encoded)throw new Error('Invalid image data.');return{buffer:Buffer.from(encoded,'base64'),mime:m[1]};};
    const artwork=parseImage(image); const form=new FormData(); form.append('model','gpt-image-2'); form.append('image',new Blob([artwork.buffer],{type:artwork.mime}),`artwork.${artwork.mime.split('/')[1]}`);
    if(isRoom){const room=parseImage(roomImage);form.append('image[]',new Blob([room.buffer],{type:room.mime}),`room.${room.mime.split('/')[1]}`);}
    form.append('prompt',prompt); form.append('size','1024x1024'); form.append('quality',isFinal?'high':'low'); form.append('output_format','png');
    const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},body:form}); const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:data?.error?.message||'Image generation failed.'});
    const result=data?.data?.[0]; if(!result?.b64_json)return res.status(502).json({error:'The image service returned no image.'});
    return res.status(200).json({image:`data:image/png;base64,${result.b64_json}`,mode,sceneTemplate:creationMode==='scene'?canonicalScene:null,personCount:creationMode==='scene'?Number(personCount):null,setting:creationMode==='scene'?setting:null,petCount:creationMode==='scene'?Number(petCount)||0:0});
  } catch(error){console.error('Generation error:',error);return res.status(500).json({error:error.message||'Something went wrong while creating the image.'});}
}
