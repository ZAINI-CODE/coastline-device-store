import { escapeHTML as e } from './core.js';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export function productReviewsMarkup(reviews, eligibility) {
  if (!reviews) return '<h2>Customer reviews</h2><p>Customer reviews are temporarily unavailable.</p>';
  const entries = reviews.map(review => {
    // Imported feedback has no supplied review date; never present import time as one.
    const date = review.feedback_source !== 'external_customer' && review.created_at ? new Date(review.created_at) : null;
    const dateMarkup = date && Number.isFinite(date.valueOf())
      ? ` · <time datetime="${e(date.toISOString())}">${e(dateFormat.format(date))}</time>` : '';
    return `<article class="review"><strong>${e(review.display_name)}</strong>${review.verified_purchase ? ' · Verified purchase' : ''} · ${e(review.rating)}/5${dateMarkup}${review.title ? `<h3>${e(review.title)}</h3>` : ''}<p>${e(review.body)}</p><button type="button" data-like-review="${e(review.id)}" aria-pressed="false">♡ Like <span data-like-count>0</span></button></article>`;
  }).join('');
  const form = eligibility === 'eligible' ? `<form id="review" class="panel" hidden>
    <h3>Add your review</h3>
    <label>Display name<input name="name" autocomplete="nickname" required maxlength="80"></label>
    <label>Star rating<select name="rating" required><option value="">Choose a rating</option>${[5,4.5,4,3.5,3,2.5,2,1.5,1].map(n=>`<option value="${n}">${n} ${n === 1 ? 'star' : 'stars'}</option>`).join('')}</select></label>
    <label>Review title<input name="title" required minlength="3" maxlength="120"></label>
    <label>Your review<textarea name="body" required minlength="10" maxlength="3000"></textarea></label>
    <button class="button">Submit for moderation</button>
  </form>` : ({
    sign_in: '<p>Sign in or create an account to add your review.</p>',
    submitted: '<p>You already submitted a review for this product.</p>',
    purchase_required: '<p>Review submissions are currently unavailable.</p>'
  })[eligibility] || '<p>Review submissions are currently unavailable.</p>';
  return `<h2>Customer reviews</h2>${entries ? `<p>${(reviews.reduce((sum, row) => sum + Number(row.rating), 0) / reviews.length).toFixed(1)} / 5 · ${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}</p>${entries}` : '<p>No approved customer reviews yet.</p>'}<button type="button" class="button" id="add-review" data-eligibility="${e(eligibility)}" aria-expanded="false" ${eligibility==='eligible'?'aria-controls="review"':''} ${!['eligible','sign_in'].includes(eligibility)?'disabled':''}>Add a Review</button>${form}`;
}

export function reviewVisitor(storage=window.localStorage){
 const key='review-visitor';let id=storage.getItem(key);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id||'')){id=crypto.randomUUID();storage.setItem(key,id);}return id;
}
export async function wireReviewLikes(root,client){
 const buttons=[...root.querySelectorAll('[data-like-review]')];if(!buttons.length||!client)return;
 buttons.forEach(button=>{button.disabled=true;});
 const visitor=reviewVisitor();const product=location.hash.split('/product/')[1]?.split('?')[0];
 const update=(button,result)=>{button.querySelector('[data-like-count]').textContent=Number(result.count)||0;button.setAttribute('aria-pressed',String(result.liked===true));button.disabled=result.liked===true;};
 buttons.forEach(button=>{button.onclick=async()=>{
  button.disabled=true;
  try{const {data,error}=await client.rpc('like_review',{p_review:button.dataset.likeReview,p_visitor:visitor});if(error)throw error;update(button,data);}
  catch{button.disabled=false;const notice=root.querySelector('#review-like-error')||Object.assign(document.createElement('p'),{id:'review-like-error',role:'status'});notice.textContent='Unable to save your like. Please try again.';root.querySelector('#add-review')?.before(notice);}
 };});
 const {data,error}=await client.rpc('product_review_likes',{p_product:product,p_visitor:visitor});
 buttons.forEach(button=>{button.disabled=false;});
 if(!error)for(const row of data||[]){const button=buttons.find(b=>b.dataset.likeReview===row.review_id);if(button)update(button,row);}
}
