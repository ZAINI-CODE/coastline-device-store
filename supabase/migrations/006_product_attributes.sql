begin;
alter table products add column product_type text;
alter table orders alter column method set not null;
create index products_category on products(category_id) where published;
create index products_search on products using gin(to_tsvector('english',name||' '||brand||' '||model));
commit;
