// v0.10.10 — streaming GLB loader with real progress and abortable timeouts.
// Zero-copy BIN accessors avoid duplicating large asset buffers on mobile.
const TYPES={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const WIDTH={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const inflight=new Map();
export function loadGlb(url,{onProgress,timeoutMs=90000}={}){
 if(inflight.has(url))return inflight.get(url);
 const job=fetchAndParse(url,onProgress,timeoutMs);
 inflight.set(url,job);
 job.then(()=>{if(inflight.get(url)===job)inflight.delete(url);},
   ()=>{if(inflight.get(url)===job)inflight.delete(url);});
 return job;
}
async function fetchAndParse(url,onProgress,timeoutMs){
 const controller=new AbortController();
 let timer=null;
 const armTimeout=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),timeoutMs)};
 armTimeout();
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error(`模型 HTTP ${response.status}：${url}`);
  const expected=Number(response.headers.get('content-length'))||0;
  let bytes,received=0;
  if(response.body?.getReader){
   const reader=response.body.getReader();let array=expected>0?new Uint8Array(expected):null,parts=[];
   while(true){const {done,value}=await reader.read();if(done)break;
    if(array&&received+value.byteLength>array.length){parts=[array.subarray(0,received)];array=null;}
    if(array)array.set(value,received);else parts.push(value);
    received+=value.byteLength;armTimeout();onProgress?.(received,expected);
   }
   if(array&&array.length===received)bytes=array.buffer;
   else{bytes=new ArrayBuffer(received);const dest=new Uint8Array(bytes);
    for(let offset=0,i=0;i<parts.length;i++){dest.set(parts[i],offset);offset+=parts[i].byteLength;}
    if(array&&received<array.length)dest.set(array.subarray(0,received));
   }
  }else{
   bytes=await response.arrayBuffer();received=bytes.byteLength;
  }
  onProgress?.(received,expected||received);
  if(bytes.byteLength<28)throw Error('模型資料不足：'+url);
  const dv=new DataView(bytes);
  if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw Error('非 GLB 2.0：'+url);
  const jsonLen=dv.getUint32(12,true),binHeader=20+jsonLen;
  if(binHeader+8>bytes.byteLength)throw Error('GLB JSON 不完整：'+url);
  const j=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,jsonLen)));
  const binLength=dv.getUint32(binHeader,true),binStart=binHeader+8;
  if(dv.getUint32(binHeader+4,true)!==0x004e4942||binStart+binLength>bytes.byteLength)throw Error('GLB BIN 不完整：'+url);
  const read=ix=>{
   const a=j.accessors[ix],bv=j.bufferViews[a.bufferView],T=TYPES[a.componentType],width=WIDTH[a.type];
   if(!T||!width)throw Error('不支援的 GLB accessor：'+ix);
   const start=binStart+(bv.byteOffset||0)+(a.byteOffset||0);
   const n=a.count*width,stride=bv.byteStride||width*T.BYTES_PER_ELEMENT;
   if(stride===width*T.BYTES_PER_ELEMENT&&start%T.BYTES_PER_ELEMENT===0)return new T(bytes,start,n);
   const result=new T(n);
   for(let i=0;i<a.count;i++)for(let k=0;k<width;k++){
    const addr=start+i*stride+k*T.BYTES_PER_ELEMENT;
    result[i*width+k]=a.componentType===5126?dv.getFloat32(addr,true):a.componentType===5125?dv.getUint32(addr,true):a.componentType===5123?dv.getUint16(addr,true):dv.getUint8(addr);
   }
   return result;
  };
  const imageFrom=ix=>{
   const im=j.images[ix],bv=j.bufferViews[im.bufferView],start=binStart+(bv.byteOffset||0);
   return new Blob([new Uint8Array(bytes,start,bv.byteLength)],{type:im.mimeType});
  };
  return {json:j,read,imageFrom};
 }catch(err){
  if(err?.name==='AbortError')throw Error(`模型下載持續 ${Math.round(timeoutMs/1000)} 秒沒有資料：${url}，請嘗試重新載入`);
  throw err;
 }finally{clearTimeout(timer);}
}
