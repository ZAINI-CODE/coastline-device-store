import {RequestError} from './http.ts';
// Re-read the committed path: a network error can occur after SQL committed.
export async function cleanupUnreferencedEvidence(admin:any,orderId:string,path:string|null){
 if(!path)return;
 try{
  const {data,error}=await admin.from('payments').select('zelle_evidence_path').eq('order_id',orderId).single();
  if(!error&&data&&Object.hasOwn(data,'zelle_evidence_path')&&data.zelle_evidence_path!==path)
   await admin.storage.from('zelle-evidence').remove([path]);
 }catch{/* Preserve evidence when the database outcome is uncertain. */}
}
export function zelleConfiguration(){
 const recipient=Deno.env.get('ZELLE_RECIPIENT_EMAIL')?.trim();
 const recipientName=Deno.env.get('ZELLE_RECIPIENT_NAME')?.trim();
 if(!recipient||!recipientName||!/^\S+@\S+\.\S+$/.test(recipient)||/PLACEHOLDER/i.test(recipient))throw new RequestError('Zelle recipient is not configured',503);
 return {recipient,recipientName};
}
export function screenshotBytes(screenshot:any){
 if(!screenshot||!['image/jpeg','image/png','image/webp'].includes(screenshot.type)||typeof screenshot.base64!=='string'||screenshot.base64.length>2796204||!screenshot.base64.length)throw new RequestError('Invalid screenshot; use JPG, PNG or WebP up to 2 MB');
 let raw:string;try{raw=atob(screenshot.base64);}catch{throw new RequestError('Invalid screenshot encoding');}
 const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(bytes.length>2097152||bytes.length<12)throw new RequestError('Invalid screenshot size');
 const matches=screenshot.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':screenshot.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!matches)throw new RequestError('Screenshot content does not match its file type');
 return {bytes,extension:screenshot.type==='image/jpeg'?'jpg':screenshot.type==='image/png'?'png':'webp',type:screenshot.type};
}
