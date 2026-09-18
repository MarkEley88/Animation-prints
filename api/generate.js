import fs from 'fs';

export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const key=process.env.OPENAI_API_KEY;
 if(!key) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
 try{
  const b=req.body||{};
  const {image,images=[],avatarImage,style,scene,dressCode='Formal / smart',cameraAngle='Closer view',mode='preview',personCount,adjustments=''}=b;
  const sources=Array.isArray(images)&&images.length?images.filter(Boolean).slice(0,5):(image?[image]:[]);
  const styles={
   'Fairytale (Disney style)':'classic premium 2D animated feature-film character art inspired by the golden-age Disney look: elegant hand-drawn linework, expressive large eyes, appealing rounded facial shapes, beautifully painted colour, subtle cel shading, charming storybook detail, polished theatrical animation finish',
   'Pencil':'exceptionally detailed graphite pencil illustration, recognisable facial structure, individual hair strokes, delicate cross-hatching, realistic light and shadow, refined traditional portrait finish',
   'Comic':'premium graphic-novel character illustration, strong confident ink linework, expressive faces, believable anatomy, rich painted colour, controlled comic-book shading and cinematic detail',
   'Chibi':'premium polished chibi character illustration, deliberately cute proportions, large expressive eyes, simplified but recognisable faces, detailed hair and clothing, high-quality digital painting',
   'Anime':'premium cinematic Japanese anime character illustration, expressive eyes, detailed hair, elegant linework, sophisticated cel shading, believable anatomy and feature-film finish'
  };
  const scenes={
   'Stately Bar':'a fixed photorealistic grand private bar inside an English stately-home mansion: dark polished timber panelling, ornate cornices, tall sash windows, antique mirrors, carved fireplace, leather club chairs, marble-topped bar, crystal decanters, brass details and deep architectural perspective; luxurious heritage atmosphere',
   'Banquet Hall':'a fixed photorealistic grand banquet hall inside an English stately-home mansion: enormous elegant dining table, linen, crystal glassware, candelabras, ornate chandelier, tall sash windows, carved wood panelling, classical paintings, fireplace, polished floor and substantial architectural depth; luxurious heritage atmosphere',
   'Mansion Library':'a fixed photorealistic grand private library inside an English stately-home mansion: floor-to-ceiling dark wood bookshelves, rolling library ladder, ornate fireplace, leather chairs, antique desk, framed paintings, tall windows, warm lamps and rich layered architectural detail; sophisticated heritage atmosphere'
  };
  const cameraAngles={
   'Wide room':'wide establishing view showing the whole room from wall to wall, including the ceiling, floor, major furniture and architectural features; characters occupy a smaller natural portion of the frame',
   'Closer view':'closer cinematic room view showing the main character area and substantial surrounding architecture, furniture and room context; characters are larger while the room remains clearly recognisable'
  };
  const count=Math.max(1,Math.min(5,Number(personCount)||1));
  const parse=data=>{const [meta,enc]=String(data||'').split(',',2),m=meta.match(/^data:(image\/[\w.+-]+);base64$/);if(!m||!enc)throw Error('Invalid image data.');return{buffer:Buffer.from(enc,'base64'),mime:m[1]}};
  const responseText=d=>typeof d?.output_text==='string'?d.output_text:(d?.output||[]).flatMap(x=>x?.content||[]).filter(x=>typeof x?.text==='string').map(x=>x.text).join('\n');
  if(mode==='styleExamples'){
   const p=process.cwd()+'/assets/style-examples/style-sheet.jpg';
   if(!fs.existsSync(p)) return res.status(500).json({error:'Permanent style example sheet is missing.'});
   return res.status(200).json({image:`data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`,mode,fixed:true});
  }
  if(mode==='analyse'){
   if(!sources.length) return res.status(400).json({error:'Please provide at least one photo.'});
   const content=[{type:'input_text',text:'Analyse ALL supplied customer photos together. Identify UNIQUE people across the whole set; the same person in multiple photos counts once. Count pets separately. Do not invent anyone. Return ONLY JSON: {"people":number,"pets":number,"notes":"brief neutral description"}.'},...sources.map(x=>({type:'input_image',image_url:x}))];
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content}],max_output_tokens:300})});
   const d=await r.json(); if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Photo analysis failed.'});
   let j;try{j=JSON.parse(responseText(d).replace(/```json|```/g,'').trim())}catch{j={people:1,pets:0,notes:'Please confirm the detected people count.'}}
   return res.status(200).json({people:Math.max(1,Math.min(5,Number(j.people)||1)),pets:Math.max(0,Number(j.pets)||0),notes:String(j.notes||'')});
  }
  if(!sources.length||!style)return res.status(400).json({error:'Please provide at least one photo and choose an avatar style.'});
  const formImages=(extra)=>{const f=new FormData();sources.forEach((src,i)=>{const a=parse(src);f.append('image[]',new Blob([a.buffer],{type:a.mime}),`source-${i+1}.jpg`)});if(extra){const a=parse(extra);f.append('image[]',new Blob([a.buffer],{type:a.mime}),'avatars.png')}return f};
  if(mode==='avatars'){
   const p=`Create a clean approval sheet containing EXACTLY ${count} distinct personalised character avatars from ALL supplied customer photos. ART STYLE: ${styles[style]||style}. This is the character identity stage only. Treat every supplied photo as identity reference, not composition. Combine the unique people across all photos and keep each person completely separate. Preserve each person's face, hair, skin tone, approximate age, body proportions, glasses and distinctive features. ${style==='Fairytale (Disney style)'?'Aim for the unmistakable charm of classic Disney 2D animated character design: elegant expressive faces, appealing eyes, clean hand-drawn contours, refined cel shading and richly painted character detail. Do not make it generic 3D cartoon art.':''} Use consistent chest-up or waist-up portraits on a clean neutral background. ${adjustments?`Customer instruction: ${adjustments}`:''} Do not invent people or animals. No text, logos or watermarks.`;
   const f=formImages();f.append('model','gpt-image-2');f.append('prompt',p);f.append('size','1024x1024');f.append('quality','low');f.append('output_format','png');
   const r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:f}),d=await r.json();
   if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Avatar generation failed.'});
   return res.status(200).json({image:`data:image/png;base64,${d.data?.[0]?.b64_json||''}`,people:count,mode});
  }
  const sceneKey=Object.keys(scenes).includes(scene)?scene:null;
  if(!sceneKey)return res.status(400).json({error:'Please choose a scene.'});
  const cameraKey=Object.keys(cameraAngles).includes(cameraAngle)?cameraAngle:'Closer view';
  const dress={
   'Formal / smart':'dress the characters in coordinated elegant formal or smart clothing appropriate to a private stately-home occasion. Tailored suits, smart dresses, shirts, polished shoes and refined details. Keep each person individually styled and believable.',
   'Family comfy':'dress the characters in attractive coordinated family-comfort clothing: quality knitwear, jumpers, cardigans, relaxed trousers, jeans, cosy dresses and soft homewear. Warm, natural and stylish rather than matching uniforms.',
   'Gangster':'dress the characters in stylish vintage gangster-inspired clothing: tailored dark suits, waistcoats, shirts, suspenders, long coats and period-inspired accessories where appropriate. Not everyone should wear a hat; vary the styling naturally by person.',
   'Graffiti / gold':'dress the characters in bold luxury streetwear with tasteful graffiti-inspired styling: premium trainers, oversized jackets, hoodies, statement pieces and selected gold jewellery such as chains, watches and rings. Accessories must be varied — not everyone wears a hat, sunglasses or chains. Keep faces visible and each person individually styled.'
  };
  const prompt=`${mode==='final'?'Create the final high-quality personalised artwork suitable for professional printing.':'Create a polished customer-approval artwork preview.'} ENVIRONMENT RENDERING: The entire mansion environment must be photorealistic, like a premium architectural/interior photograph. Use physically believable materials, realistic wood, stone, glass, fabric and metal, natural reflections, realistic depth, lighting and shadows. Do not render the room as illustration, cartoon, CGI concept art or painterly artwork. CHARACTER STYLE: ${styles[style]||style}. FIXED SCENE: ${scenes[sceneKey]}. CAMERA ANGLE: ${cameraAngles[cameraKey]}. The scene is a locked environmental layer. Preserve the selected mansion room type, architecture, furniture arrangement, windows, walls, fireplace, bar/bookshelves/table, lighting direction and overall composition. The selected camera angle is also locked. Use ONLY this camera angle: either a wide whole-room establishing view or the closer room view, never an intermediate crop or alternate angle. The scene and camera framing must NOT change when the character illustration style or dress code changes. Only the people and their clothing/accessories may change. EXACTLY ${count} PEOPLE. Place each approved avatar as a distinct person naturally within the room with believable scale, perspective, pose and interaction. DRESS CODE: ${dress[dressCode]||dress['Formal / smart']} ${adjustments?`CUSTOM CUSTOMER INSTRUCTION: ${adjustments}`:''} Use the uploaded photos only as identity references and the approved avatar image as the character reference. Do not copy original poses, backgrounds, seating or camera framing. Do not invent or remove people. Do not turn the room into a different location. No text, logos or watermarks.`;
  const f=formImages(avatarImage);f.append('model','gpt-image-2');f.append('prompt',prompt);f.append('size','1024x1024');f.append('quality',mode==='final'?'high':'low');f.append('output_format','png');
  const r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:f}),d=await r.json();
  if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Image generation failed.'});
  return res.status(200).json({image:`data:image/png;base64,${d.data?.[0]?.b64_json||''}`,mode,people:count,scene:sceneKey,dressCode,cameraAngle:cameraKey});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||'Something went wrong while creating the image.'})}
}