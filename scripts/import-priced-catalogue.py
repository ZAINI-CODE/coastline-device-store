"""Import owner workbook into local catalogue only. Never connects to Supabase."""
import sys, json, re, hashlib, datetime
from pathlib import Path
from decimal import Decimal
import openpyxl

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
book = openpyxl.load_workbook(source, data_only=True)
formula_book = openpyxl.load_workbook(source, data_only=False)
private = root / '.private' / 'catalogue'
private.mkdir(parents=True, exist_ok=True)
def default(value):
    return value.isoformat() if isinstance(value, (datetime.datetime, datetime.date)) else str(value)
def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=default)+'\n', encoding='utf-8')
def cents(value):
    if not isinstance(value, (int, float)) or value <= 0:
        raise ValueError('Missing or invalid price: '+str(value))
    return int(Decimal(str(value))*100)
def specs(text):
    # Split only labelled fields: semicolons inside SSD/port descriptions stay intact.
    result = {}
    key = None
    for part in str(text or '').split('; '):
        match = re.match(r'^([A-Za-z][A-Za-z /&-]{0,40}): (.+)$',part)
        if match:
            key,value=match.groups()
            if key != 'Verification': result[key]=value
        elif key in result: result[key]+='; '+part
    return result

products=json.loads((root/'data/products.json').read_text(encoding='utf-8'))
save(private/'products-before-priced-import.json',products) if not (private/'products-before-priced-import.json').exists() else None
snapshot={s.title:{'rows':s.max_row,'columns':s.max_column,'cells':[{ 'cell':c.coordinate,'value':c.value,'formula':formula_book[s.title][c.coordinate].value if formula_book[s.title][c.coordinate].data_type=='f' else None} for row in s for c in row if c.value is not None]} for s in book}
save(private/'workbook-all-cells.json',snapshot)
sheet=book['Catalogue']
rows=[(i,dict(zip([c.value for c in sheet[6]],row))) for i,row in enumerate(sheet.iter_rows(min_row=7,values_only=True),7) if row[0]]
by_id={p['id']:p for p in products}
assert len({r['Product ID'] for _,r in rows})==len(rows)
assert all(r['Product ID'] in by_id for _,r in rows), 'Unmatched product ID'
prices={}
for i,row in enumerate(book['iPhone prices'].iter_rows(min_row=8,values_only=True),8):
    if not row[0]:continue
    prices.setdefault(row[0],[]).append({'configuration':row[2], 'price_cents':cents(row[5]),'reference_price_cents':cents(row[3]),'reference_note':row[11],'source':row[12],'source_row':i})
pc={}
notes={}
for row in book['PC supplied details'].iter_rows(min_row=6,values_only=True):
    if not row[0]:continue
    if row[1]=='Pending check':notes.setdefault(row[0],[]).append(row[2])
    else:pc.setdefault(row[0],{})[row[1]]=row[2]
for i,row in rows:
    p=by_id[row['Product ID']]
    assert p['category']==row['Category'], 'Category mismatch'
    p['name']=row['Model']
    p['specifications'].update(specs(row['Verified specifications']))
    if row['Your SKU']:p['model_number']=row['Your SKU']
    if p['id'] in pc:
        raw=pc[p['id']]
        # Retain all supplied details, but keep previously flagged claims out of verified specs.
        p['supplied_details']={'source_file':source.name,'raw':raw,'notes':notes.get(p['id'],[])}
        model=raw.get('Model / Part Number')
        if model and model!='Not provided':p['model_number']=model
    selections=prices.get(p['id']) or [{'configuration':row['Your colour / storage'] or p.get('model_number') or 'Standard configuration','price_cents':cents(row['Indicative Price (USD)'])}]
    if p['id']=='ibuypower-ryzen-5-9500f':selections[0]['price_cents']=147900
    p['sale_price_cents']=min(v['price_cents'] for v in selections)
    p['inventory']=15
    p['catalogue_update']={'source_file':source.name,'sheet':'Catalogue','row':i,'currency':'USD','stock_scope':'model_total','stock_quantity':15,'price_label':'Indicative / reference price','pricing_note':row['Pricing note'],'configurations':selections,'condition':row['Condition'],'owner_sku':row['Your SKU'],'photo_filenames':row['Photo filenames'],'specification_status':'Owner workbook; listed pending checks remain unresolved'}
references=json.loads((root/'data/catalogue-price-references.json').read_text(encoding='utf-8'))
for pid,reference in references.items():
    if any(r['Product ID']==pid for _,r in rows):continue
    p=by_id[pid]
    p['sale_price_cents']=reference['price_cents']
    p['inventory']=15
    p['catalogue_update']={'source_file':'Manufacturer reference research','sheet':None,'row':None,'currency':'USD','stock_scope':'model_total','stock_quantity':15,'price_label':reference['price_label'],'pricing_note':reference['pricing_note'],'price_source':reference['source'],'price_checked_on':reference['checked_on'],'configurations':[{'configuration':reference['configuration'],'price_cents':reference['price_cents']}],'owner_sku':None,'specification_status':'Exact supplied charging case and SKU pending'}
save(root/'data/products.json',products)
plan=json.loads((root/'data/iphone-pricing.json').read_text(encoding='utf-8'))
plan['as_of']='2026-11-07'
plan['scope']='Owner workbook indicative prices; model stock total 15, variant allocation pending. References are not previous store selling prices.'
plan['rows']=[{'product_id':pid,'product_name':by_id[pid]['name'],'storage':v['configuration'],'reference_price_cents':v['reference_price_cents'],'proposed_price_cents':v['price_cents'],'discount_cents':v['reference_price_cents']-v['price_cents'],'discount_percent':100*(v['reference_price_cents']-v['price_cents'])/v['reference_price_cents'],'currency':'USD','source':v['source'],'checked_on':'2026-11-07','verification_status':'owner_workbook_reference','note':v['reference_note'],'inventory':15,'stock_scope':'model_total_not_per_storage','published':False} for pid,vs in prices.items() for v in vs]
save(root/'data/iphone-pricing.json',plan)
# Admin-only staged information: never copied into public data or builds.
save(private/'internal-costs.json',{'ibuypower-ryzen-5-9500f':{'supplier_cost_cents':130000,'currency':'USD','hosted_admin_storage':'Pending authorized private storage; no public product field'}})
report={'source_file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sheets':[{ 'name':s.title,'rows':s.max_row,'columns':s.max_column} for s in book],'matched_products':len(rows),'total_updated':sum('catalogue_update' in p for p in products),'new_products':0,'iphone_storage_prices':sum(map(len,prices.values())),'researched_missing_prices':len(references),'researched_references':references,'workbook_reference_prices':len(rows),'model_stock':15,'variant_stock_allocation':'Pending owner allocation; no duplicated stock','not_in_workbook':[p['id'] for p in products if p['id'] not in {r['Product ID'] for _,r in rows}],'categories':{c:sum(p['category']==c and 'catalogue_update' in p for p in products) for c in {p['category'] for p in products}},'pending_checks':notes,'hosted_writes':False}
save(root/'data/catalogue-import-report.json',report)
print(json.dumps(report,ensure_ascii=True))
