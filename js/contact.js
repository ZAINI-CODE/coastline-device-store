import { db, unwrap } from "./api.js";
import { escapeHTML as e } from "./core.js";
async function contactPage(store) {
  const user = db ? (await db.auth.getUser()).data.user : null;
  const details = [store.supportEmail || store.email,store.phone,store.hours].filter(Boolean);
  const form = user
    ? '<form id="contact-form" class="panel contact-form"><h2>Send a private message</h2><p>For order help, include your order number. Keep passwords and payment details out of the message.</p><label>Subject<input name="subject" minlength="3" maxlength="150" required></label><label>Message<textarea name="message" minlength="10" maxlength="5000" rows="6" required></textarea></label><button class="button">Send message</button><p id="contact-status" role="status"></p></form>'
    : `<div class="panel"><h2>Send a private message</h2><p>${db?'Sign in to ask about products, delivery or your account.':'Online messaging is currently unavailable.'}</p>${db?'<a class="button" id="contact-sign-in" href="#/account">Sign in to contact us</a>':''}</div>`;
  return `<section class="wrap page prose policy-page"><span class="eyebrow">HERE TO HELP</span><h1>Contact us</h1><p class="intro">Get help with a product, order, or account.</p>${details.length?`<div class="panel"><h2>Customer support</h2>${details.map(value=>`<p>${e(value)}</p>`).join('')}</div>`:''}${form}<nav class="policy-links" aria-label="More help"><a class="text-link" href="#/faq">Read the FAQs →</a><a class="text-link" href="#/account">Order support →</a></nav></section>`;
}
function wireContact() {
  document.querySelector('#contact-sign-in')?.addEventListener('click',()=>sessionStorage.setItem('returnTo','#/contact'));
  document.querySelector("#contact-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button'), status = form.querySelector('#contact-status');
    if (button.disabled) return;
    const f = new FormData(form), subject = f.get("subject").trim(), message = f.get("message").trim();
    if (subject.length < 3 || message.length < 10) {
      status.textContent = 'Enter a subject of at least 3 characters and a message of at least 10 characters.';
      return;
    }
    button.disabled = true;
    try {
      await unwrap(db.rpc("send_contact", { p_subject: subject, p_message: message }));
      form.reset();
      status.textContent = "Your message was sent.";
    } catch {
      status.textContent = 'Your message could not be sent. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}
export {
  contactPage,
  wireContact
};
