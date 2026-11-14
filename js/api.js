import { safeImage } from "./core.js";
import { createClient } from "@supabase/supabase-js";
import {databaseCatalogue} from './database-catalogue.js';
let db = null;
let settings = {};
async function initialize() {
  settings = await fetch("./config/public.json").then((r) => r.json());
  if (!settings.frontendReview && settings.supabaseUrl && settings.supabaseKey) {
    db = createClient(settings.supabaseUrl, settings.supabaseKey, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
    // Finish PKCE callback/session restoration before rendering a sign-in form.
    await db.auth.getSession();
  }
}
async function unwrap(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}
async function invoke(action, body = {}) {
  if (!db) throw new Error("Store services are awaiting configuration.");
  const { data, error } = await db.functions.invoke("store-api", { body: { action, ...body } });
  if (error) {
    let message = error.message;
    try {
      const response = await error.context?.json();
      if (typeof response?.error === "string") message = response.error.slice(0, 300);
    } catch {
    }
    throw new Error(message);
  }
  return data;
}
async function catalogue() {
  if(settings.frontendReview&&settings.localTools){
    const response = await fetch('./data/store-zip-preview.json');
    if (!response.ok) throw new Error('Store image preview unavailable.');
    return databaseCatalogue(await response.json()).map(product => ({...product, review_only:true}));
  }
  if (!db) return [];
  const [rows, promotions] = await Promise.all([
    unwrap(db.rpc("storefront_catalogue")),
    unwrap(db.from('promotions').select('id,name,kind,minimum_quantity,percent_basis_points,discount_cents,starts_at,ends_at,active,promotion_products(product_id,percent_basis_points,display_style)')
      .eq('active', true).eq('kind', 'quantity').eq('minimum_quantity', 1).eq('discount_cents', 0)).catch(() => [])
  ]);
  return databaseCatalogue(rows).map(product => ({
    ...product,
    promotions: promotions.filter(offer => offer.promotion_products?.some(row => row.product_id === product.id))
  }));
}
export {
  catalogue,
  db,
  initialize,
  invoke,
  settings,
  unwrap
};
