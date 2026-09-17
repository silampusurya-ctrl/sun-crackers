const AUTH_BASE='https://ep-aged-surf-audmeorm.neonauth.c-10.us-east-1.aws.neon.tech/suncrackers/auth';
const DATA_BASE='https://ep-aged-surf-audmeorm.apirest.c-10.us-east-1.aws.neon.tech/suncrackers/rest/v1';

module.exports=async function handler(req,res){
  try{
    const kind=String(req.query.kind||'');
    const raw=Array.isArray(req.query.path)?req.query.path.join('/'):String(req.query.path||'');
    const base=kind==='auth'?AUTH_BASE:kind==='data'?DATA_BASE:null;
    if(!base){res.status(400).json({error:'Invalid proxy target'});return}
    const target=new URL(base.replace(/\/$/,'')+'/'+raw.replace(/^\/+/,''));    
    for(const [key,value] of Object.entries(req.query)){
      if(key==='kind'||key==='path')continue;
      if(Array.isArray(value))value.forEach(v=>target.searchParams.append(key,String(v)));
      else if(value!=null)target.searchParams.append(key,String(value));
    }
    const headers={...req.headers};
    delete headers.host;delete headers.connection;delete headers['content-length'];delete headers['transfer-encoding'];delete headers.forwarded;
    Object.keys(headers).forEach(k=>{if(k.startsWith('x-forwarded-')||k.startsWith('x-vercel-'))delete headers[k]});
    headers['accept-encoding']='identity';
    let body;
    if(req.method!=='GET'&&req.method!=='HEAD'){
      if(Buffer.isBuffer(req.body))body=req.body;
      else if(typeof req.body==='string')body=req.body;
      else if(req.body!=null){body=JSON.stringify(req.body);headers['content-type']=headers['content-type']||'application/json'}
    }
    const upstream=await fetch(target,{method:req.method,headers,body,redirect:'manual'});
    for(const [key,value] of upstream.headers.entries()){
      const k=key.toLowerCase();
      if(['content-length','content-encoding','transfer-encoding','connection','set-cookie'].includes(k))continue;
      res.setHeader(key,value);
    }
    const cookies=upstream.headers.getSetCookie?upstream.headers.getSetCookie():[];
    const fallback=upstream.headers.get('set-cookie');
    const all=cookies.length?cookies:(fallback?[fallback]:[]);
    if(all.length)res.setHeader('set-cookie',all.map(c=>c.replace(/;\s*Domain=[^;]+/ig,'')));
    const bytes=Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(bytes);
  }catch(error){
    res.status(502).json({error:'Cloud connection failed',detail:error&&error.message?error.message:String(error)});
  }
};