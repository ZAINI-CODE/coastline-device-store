import {escapeHTML as e} from './core.js';
import {phoneFields,wirePhone} from './checkout-phone.js';

export function googlePicture(value){
 try{const url=new URL(value);return url.protocol==='https:'&&/^[a-z0-9-]+\.googleusercontent\.com$/i.test(url.hostname)&&!url.username&&!url.password&&url.port===''?url.href:null;}catch{return null;}
}
export function avatarPath(value,userId){return typeof value==='string'&&value.startsWith(userId+'/')&&new RegExp('^'+userId+'/[0-9a-f-]{36}\\.webp$').test(value)?value:null;}
export async function profilePicture(client,profile,user){
 const path=avatarPath(profile?.avatar_path,user.id);
 if(profile?.avatar_mode==='upload'&&path){const {data,error}=await client.storage.from('profile-avatars').createSignedUrl(path,3600);if(!error)return data.signedUrl;}
 return profile?.avatar_mode==='google'?googlePicture(profile.google_avatar_url):null;
}
export function profileOverview(profile,user,picture){
 const name=profile?.display_name||user.user_metadata?.full_name||'Your account';
 return `<section class="panel profile-overview"><span class="profile-avatar">${picture?`<img src="${e(picture)}" alt="Your profile picture" referrerpolicy="no-referrer">`:`<span aria-hidden="true">${e(name.slice(0,1).toUpperCase())}</span>`}</span><div><h2>${e(name)}</h2><p>${e(user.email)}</p><p>${e(profile?.phone||'Add your contact number in Edit Profile.')}</p><button type="button" class="text-button" data-view-orders>View order history</button></div></section><details class="panel profile-editor"><summary>Edit Profile</summary><form id="profile"><label>Display name<input name="display_name" maxlength="80" autocomplete="name" value="${e(profile?.display_name||'')}"></label>${phoneFields({required:false})}<label>Profile picture<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="field-help">JPG, PNG or WebP, up to 2 MB. Your picture is stored privately.</p><button type="submit" class="button action-positive">Save profile</button><button type="button" id="remove-avatar" class="action-destructive">Remove picture</button>${googlePicture(profile?.google_avatar_url)?'<button type="button" id="use-google-avatar">Use Google picture</button>':''}</form><p id="profile-result" role="status"></p></details>`;
}
export function validateAvatar(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<1||file.size>2097152)throw new Error('Choose a JPG, PNG or WebP picture up to 2 MB.');}
export async function prepareAvatar(file){
 validateAvatar(file);
 const image=await createImageBitmap(file);
 try{
  if(!image.width||!image.height||image.width*image.height>40000000)throw new Error('Choose an image smaller than 40 megapixels.');
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const side=Math.min(image.width,image.height);canvas.getContext('2d').drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,512,512);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.85));if(!blob)throw new Error('Picture could not be processed.');return blob;
 }finally{image.close();}
}
export function wireProfile(client,user,profile,render,notify){
 const form=document.querySelector('#profile');if(!form)return;
 const avatar=document.querySelector('.profile-avatar img');if(avatar)avatar.onerror=()=>{avatar.parentElement.textContent=(profile?.display_name||'You').slice(0,1).toUpperCase();};
 const phone=wirePhone(form);phone.set(profile?.phone||'');
 const result=document.querySelector('#profile-result');
 const cleanup=async path=>{if(path)await client.storage.from('profile-avatars').remove([path]);};
 const run=async operation=>{const controls=[...form.querySelectorAll('button')];controls.forEach(b=>b.disabled=true);try{await operation();notify('Profile updated.');await render();}catch(error){result.textContent=error.message;controls.forEach(b=>b.disabled=false);}};
 form.onsubmit=event=>{event.preventDefault();phone.validate();if(!form.reportValidity())return;const data=new FormData(form);return run(async()=>{
  const update={id:user.id,display_name:String(data.get('display_name')||'').trim(),phone:data.get('phone')||null};let uploaded;
  try{
   const file=data.get('avatar');if(file?.size){const blob=await prepareAvatar(file);uploaded=user.id+'/'+crypto.randomUUID()+'.webp';const {error}=await client.storage.from('profile-avatars').upload(uploaded,blob,{contentType:'image/webp',upsert:false});if(error)throw error;update.avatar_path=uploaded;update.avatar_mode='upload';}
   const {error}=await client.from('profiles').upsert(update);if(error)throw error;
  }catch(error){await cleanup(uploaded);throw error;}
  if(uploaded)await cleanup(avatarPath(profile?.avatar_path,user.id));
 });};
 const setMode=mode=>run(async()=>{const {error}=await client.from('profiles').update({avatar_path:null,avatar_mode:mode}).eq('id',user.id);if(error)throw error;await cleanup(avatarPath(profile?.avatar_path,user.id));});
 document.querySelector('#remove-avatar').onclick=()=>setMode('none');
 document.querySelector('#use-google-avatar')?.addEventListener('click',()=>setMode('google'));
}
