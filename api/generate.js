import fs from 'fs';

export default async function handler(req,res){
 if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
 const key=process.env.OPENAI_API_KEY;
 if(!key) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
 try{
  const b=req.body||{};
  const {image,images=[],avatarImage,roomImage,style,scene,setting='Default',clothing='Keep current',accessories='None',sceneTreatment='Cinematic',zoom='Wide',mode='preview',personCount,adjustments=''}=b;
  const sources=Array.isArray(images)&&images.length?images.filter(Boolean).slice(0,5):(image?[image]:[]);
  const styles={
   'Anime':'cinematic Japanese anime illustration, polished feature-film quality, expressive faces, detailed hair and eyes, sophisticated cel shading',
   'Fairytale Animation':'premium modern fairytale animated-film illustration, richly detailed painterly characters, expressive faces, soft cinematic lighting',
   '3D Cartoon':'high-end 3D animated feature-film character render, realistic materials, detailed hair and clothing, expressive natural faces, cinematic lighting',
   'Comic Book':'premium graphic-novel illustration, believable anatomy, detailed ink linework, controlled comic shading, rich painted colour',
   'Chibi':'premium chibi character illustration, cute proportions, large expressive eyes, detailed hair and clothing, polished digital painting',
   'Watercolour':'high-end editorial watercolour portrait, recognisable realistic features, delicate layered washes, paper texture, fine brush detail',
   'Pencil Illustration':'highly detailed graphite pencil illustration, realistic facial structure, individual hair strokes, fine shading and paper texture',
   'Pop Art':'premium contemporary pop-art portrait, recognisable face and anatomy, bold graphic colour blocking, crisp halftone texture'
  };
  const fixed={
   'Grand Banquet':['standing at the head of the banquet table','seated on the left side of the table','seated on the right side of the table','seated further along the table','standing beside the table'],
   'Christmas Morning':['kneeling beside the tree with a present','sitting on the floor opening a present','sitting near the presents','standing beside the tree','standing near the fireplace'],
   'Football Stadium':['standing pitch-side','sitting in the front row','standing beside the advertising boards','walking down the stadium steps','standing near the tunnel entrance'],
   'Tropical Holiday':['standing beside the shoreline','sitting on a beach lounger','walking near the water','sitting beneath a parasol','standing near tropical plants'],
   'Enchanted Castle':['standing on the grand staircase','standing beside a window','standing beside a castle table','standing near the fireplace','standing in the hall'],
   'Birthday Party':['standing beside the birthday cake','sitting near the presents','sitting at the party table','standing beside the decorations','standing near the party table'],
   'Camping Adventure':['standing beside the tent','sitting beside the campfire','sitting on a camping chair','walking beside the campsite','standing beside the picnic table'],
   'Ski Holiday':['standing on the snowy slope','sitting at the ski lodge','walking near the lift','standing beside the ski hut','standing beside the piste']
  };
  const aliases={'Banquet':'Grand Banquet','Christmas':'Christmas Morning','Football':'Football Stadium','Beach':'Tropical Holiday','Birthday':'Birthday Party','Ski Resort':'Ski Holiday','Medieval Castle':'Enchanted Castle'};
  const canonical=aliases[scene]||scene;
  const count=Math.max(1,Math.min(5,Number(personCount)||1));
  const parse=data=>{const [meta,enc]=String(data||'').split(',',2),m=meta.match(/^data:(image\/[\w.+-]+);base64$/);if(!m||!enc)throw Error('Invalid image data.');return{buffer:Buffer.from(enc,'base64'),mime:m[1]};};
  const text=data=>typeof data?.output_text==='string'?data.output_text:(data?.output||[]).flatMap(x=>x?.content||[]).filter(x=>typeof x?.text==='string').map(x=>x.text).join('\n');
  if(mode==='styleExamples'){
   const p=process.cwd()+'/assets/style-examples/style-sheet.jpg';
   if(!fs.existsSync(p)) return res.status(500).json({error:'Permanent style example sheet is missing.'});
   const img=fs.readFileSync(p).toString('base64');
   return res.status(200).json({image:`data:image/jpeg;base64,${img}`,mode:'styleExamples',fixed:true});
  }
  if(mode==='analyse'){
   if(!sources.length)return res.status(400).json({error:'Please provide at least one photo.'});
   const content=[{type:'input_text',text:'Analyse ALL supplied customer photos together. Identify UNIQUE people across the whole set; the same person in multiple photos counts once. Count pets separately. Do not invent anyone. Return ONLY JSON: {"people":number,"pets":number,"notes":"brief neutral description"}.'},...sources.map(x=>({type:'input_image',image_url:x}))];
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:[{role:'user',content}],max_output_tokens:300})});
   const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Photo analysis failed.'});
   let j;try{j=JSON.parse(text(d).replace(/```json|```/g,'').trim())}catch{j={people:1,pets:0,notes:'Please confirm the detected people count.'};}
   return res.status(200).json({people:Math.max(1,Math.min(5,Number(j.people)||1)),pets:Math.max(0,Number(j.pets)||0),notes:String(j.notes||'')});
  }
  if(!sources.length||!style)return res.status(400).json({error:'Please provide at least one photo and a style.'});
  const formImages=async(extra)=>{const f=new FormData();f.append('model','gpt-image-2');for(let i=0;i<sources.length;i++){const x=parse(sources[i]);f.append('image[]',new Blob([x.buffer],{type:x.mime}),`source-${i+1}.jpg`);}if(extra){const x=parse(extra);f.append('image[]',new Blob([x.buffer],{type:x.mime}),'avatars.png');}return f;};
  if(mode==='avatars'){
   const prompt=`Create a clean approval sheet of EXACTLY ${count} distinct personalised character avatars from ALL supplied customer photos. Visual style: ${styles[style]||style}. Treat supplied photos as identity references, not composition. Combine the unique people across all photos and keep every person separate. Preserve face, hair, skin tone, approximate age, body proportions, glasses and distinctive features. Consistent chest-up or waist-up portraits on a neutral background. ${adjustments?`Customer instruction: ${adjustments}`:''} Do not invent people or animals. No text, logos or watermarks.`;
   const f=await formImages();f.append('prompt',prompt);f.append('size','1024x1024');f.append('quality','low');f.append('output_format','png');
   const r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:f});const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Avatar generation failed.'});
   return res.status(200).json({image:`data:image/png;base64,${d.data?.[0]?.b64_json||''}`,people:count,mode});
  }
  if(mode==='room'){
   if(!roomImage)return res.status(400).json({error:'Please provide a room image.'});const a=parse(image),room=parse(roomImage),f=new FormData();f.append('model','gpt-image-2');f.append('image[]',new Blob([a.buffer],{type:a.mime}),'artwork.png');f.append('image[]',new Blob([room.buffer],{type:room.mime}),'room.jpg');f.append('prompt','Use the supplied room photo as the exact environment. Place the supplied finished artwork as a framed print on a suitable visible wall. Keep room architecture, furniture, lighting and perspective realistic. Do not alter the artwork.');f.append('size','1024x1024');f.append('quality','low');f.append('output_format','png');const r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:f});const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Visualisation failed.'});return res.status(200).json({image:`data:image/png;base64,${d.data?.[0]?.b64_json||''}`,mode});
  }
  if(!fixed[canonical])return res.status(400).json({error:'Please choose an approved standard scene.'});
  const roles=fixed[canonical].slice(0,count);
  const zoomText={Standard:'medium-wide composition showing the people and key scene',Wide:'wide cinematic composition showing the people plus substantial surrounding environment', 'Full Room':'very wide establishing composition showing the full room, architecture, furniture, floor and ceiling while keeping every person clearly visible'};
  const treatments={Cinematic:'premium cinematic feature-film composition, natural depth, believable lighting and rich environmental detail',Storybook:'beautiful illustrated storybook composition with layered foreground, middle ground and background',Editorial:'high-end editorial illustration with sophisticated composition and controlled detail','Warm Family':'warm inviting family portrait atmosphere with natural expressions and polished environmental detail',Grand:'luxurious dramatic composition with strong architectural detail and elegant lighting'};
  const prompt=`${mode==='final'?'Create the final high-quality personalised artwork suitable for professional printing.':'Create a polished visual preview suitable for customer approval.'} Visual style: ${styles[style]||style}. Scene treatment: ${treatments[sceneTreatment]||sceneTreatment}. Standard scene: ${canonical}. EXACTLY ${count} PEOPLE. Fixed roles: ${roles.map((x,i)=>`slot ${i+1}: ${x}`).join('; ')}. Camera: ${zoomText[zoom]||zoomText.Wide}. Build a believable professionally illustrated environment with detailed foreground, middle ground and background. Avoid generic empty backgrounds and cramped close-ups. Setting/theme: ${setting}. Clothing layer: ${clothing}. Accessory layer: ${accessories}. Treat original photos as identity references, not composition. Discard original poses, seating, camera position, spacing and cropping. Preserve every person's identity. Never invent an extra person or remove one. ${adjustments?`Customer instruction: ${adjustments}`:''} No text, logos or watermarks.`;
  const f=await formImages(avatarImage);f.append('prompt',prompt);f.append('size','1024x1024');f.append('quality',mode==='final'?'high':'low');f.append('output_format','png');
  const r=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:f});const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d?.error?.message||'Image generation failed.'});return res.status(200).json({image:`data:image/png;base64,${d.data?.[0]?.b64_json||''}`,mode,people:count,scene:canonical});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||'Something went wrong while creating the image.'});}
}