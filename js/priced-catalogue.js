// Model totals are deliberately separate from variant inventory. A photo is not
// proof that 15 units exist for every colour and storage combination.
export function pricedCatalogueProduct(product,photoVariants){
 const update=product.catalogue_update;
 if(!update)return product;
 const bases=photoVariants.length?photoVariants:[{color:'Colour to confirm',images:[],image_path:null}];
 const variants=bases.flatMap((base,i)=>update.configurations.map((configuration,j)=>({...base,
  id:`owner-preview-${product.id}-${i}-${j}`,variant_key:`owner-${product.id}-${i}-${j}`,
  configuration:configuration.configuration,price_cents:configuration.price_cents,price_note:configuration.reference_note||update.pricing_note,
  sku:update.owner_sku||product.model_number||null,
  specifications:{...base.specifications,...(/^(\d+GB|\d+TB)$/.test(configuration.configuration)?{Storage:configuration.configuration}:{})},
  stock:null,inventory:null,active:false
 })));
 return {...product,variants,price:Math.min(...variants.map(v=>v.price_cents)),reference_price:null,
  model_stock:update.stock_quantity,availability_reference:'In Stock',price_label:update.price_label};
}
