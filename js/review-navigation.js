const key='review-return';
export function validReviewReturn(value){return typeof value==='string'&&/^#\/product\/[0-9a-f-]{36}\?(?:[\w%=&.-]+)$/.test(value)&&new URLSearchParams(value.split('?')[1]).get('review')==='1'?value:null;}
export function reviewReturn(storage=window.sessionStorage,hash=location.hash){
 return validReviewReturn(new URLSearchParams(hash.split('?')[1]||'').get('return'))||validReviewReturn(storage.getItem(key));
}
export function rememberReview(storage=window.sessionStorage,hash=location.hash){
 const [path,query='']=hash.split('?');const params=new URLSearchParams(query);params.set('review','1');
 const target=validReviewReturn(path+'?'+params);if(target)storage.setItem(key,target);return target;
}
export function resumeReview(storage=window.sessionStorage,hash=location.hash){
 const target=reviewReturn(storage,hash);if(!target)return false;storage.removeItem(key);location.hash=target;return true;
}
export function reviewAuthRedirect(){const target=reviewReturn();return location.origin+location.pathname+'#/account'+(target?'?return='+encodeURIComponent(target):'');}
export function validStoreReturn(value){return typeof value==='string'&&/^#\/(?:checkout(?:\?order=[0-9a-f-]{36})?|shop(?:\?[^#\s]*)?|product\/[0-9a-f-]{36}(?:\?[^#\s]*)?|cart|)$/.test(value)?value:null;}
export function resumeAfterSignIn(){
 if(resumeReview())return true;
 const target=validStoreReturn(sessionStorage.getItem('returnTo'));
 sessionStorage.removeItem('returnTo');
 if(!target)return false;location.hash=target;return true;
}
