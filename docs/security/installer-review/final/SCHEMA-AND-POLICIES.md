# Complete local installer catalogue

Reviewed installer SHA-256: `7750584909226e1e0497ab925614f5b976a86a1b4473cf38ef4c3dbba3325cc1`.

LOCAL PGlite simulation; not a hosted-project audit. Corrected consolidated installer (eleven source migrations). No remote execution.

All column names, nullability, defaults, constraints, foreign keys, RLS policies, functions, triggers and indexes follow. Function definitions are the final installed definitions.

## public.admin_audit_logs

RLS enabled: true; forced: false.

Columns:

- `id`: int8; NOT NULL; identity.
- `actor`: uuid; nullable; no default.
- `action`: text; NOT NULL; no default.
- `record_id`: text; nullable; no default.
- `created_at`: timestamptz; nullable; default now().
- `outcome`: text; NOT NULL; default 'success'::text.

Constraints and relationships:

- `admin_audit_logs_action_not_null`: `NOT NULL action`.
- `admin_audit_logs_id_not_null`: `NOT NULL id`.
- `admin_audit_logs_outcome_not_null`: `NOT NULL outcome`.
- `admin_audit_logs_pkey`: `PRIMARY KEY (id)`.

RLS policies:

- `admin_audit`: SELECT; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX admin_audit_logs_pkey ON public.admin_audit_logs USING btree (id)`;

Triggers:

- None.

## public.admin_members

RLS enabled: true; forced: false.

Columns:

- `user_id`: uuid; NOT NULL; no default.

Constraints and relationships:

- `admin_members_pkey`: `PRIMARY KEY (user_id)`.
- `admin_members_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `admin_members_user_id_not_null`: `NOT NULL user_id`.

RLS policies:

- No client policies; RLS defaults to deny for non-bypass roles.

Indexes:

- `CREATE UNIQUE INDEX admin_members_pkey ON public.admin_members USING btree (user_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.admin_members FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.carts

RLS enabled: true; forced: false.

Columns:

- `user_id`: uuid; NOT NULL; default auth.uid().
- `items`: jsonb; NOT NULL; default '[]'::jsonb.

Constraints and relationships:

- `carts_items_not_null`: `NOT NULL items`.
- `carts_pkey`: `PRIMARY KEY (user_id)`.
- `carts_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `carts_user_id_not_null`: `NOT NULL user_id`.

RLS policies:

- `own_cart`: ALL; roles authenticated; PERMISSIVE; USING `(user_id = auth.uid())`; WITH CHECK `(user_id = auth.uid())`.

Indexes:

- `CREATE UNIQUE INDEX carts_pkey ON public.carts USING btree (user_id)`;

Triggers:

- None.

## public.categories

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `name`: text; NOT NULL; no default.

Constraints and relationships:

- `categories_id_not_null`: `NOT NULL id`.
- `categories_name_key`: `UNIQUE (name)`.
- `categories_name_not_null`: `NOT NULL name`.
- `categories_pkey`: `PRIMARY KEY (id)`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_categories`: SELECT; roles public; PERMISSIVE; USING `true`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name)`;
- `CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.contact_messages

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `user_id`: uuid; NOT NULL; default auth.uid().
- `subject`: text; NOT NULL; no default.
- `message`: text; NOT NULL; no default.
- `created_at`: timestamptz; nullable; default now().
- `handled`: bool; NOT NULL; default false.

Constraints and relationships:

- `contact_messages_handled_not_null`: `NOT NULL handled`.
- `contact_messages_id_not_null`: `NOT NULL id`.
- `contact_messages_message_check`: `CHECK (((length(message) >= 10) AND (length(message) <= 5000)))`.
- `contact_messages_message_not_null`: `NOT NULL message`.
- `contact_messages_pkey`: `PRIMARY KEY (id)`.
- `contact_messages_subject_check`: `CHECK (((length(subject) >= 3) AND (length(subject) <= 150)))`.
- `contact_messages_subject_not_null`: `NOT NULL subject`.
- `contact_messages_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `contact_messages_user_id_not_null`: `NOT NULL user_id`.

RLS policies:

- `handle_messages`: UPDATE; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `own_messages`: SELECT; roles authenticated; PERMISSIVE; USING `((user_id = auth.uid()) OR is_admin())`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX contact_messages_pkey ON public.contact_messages USING btree (id)`;

Triggers:

- `CREATE TRIGGER contact_audit AFTER UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.customer_addresses

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `user_id`: uuid; NOT NULL; default auth.uid().
- `full_name`: text; NOT NULL; no default.
- `line1`: text; NOT NULL; no default.
- `line2`: text; nullable; default ''::text.
- `city`: text; NOT NULL; no default.
- `state`: text; NOT NULL; no default.
- `postal_code`: text; NOT NULL; no default.
- `country`: text; NOT NULL; no default.

Constraints and relationships:

- `customer_addresses_city_not_null`: `NOT NULL city`.
- `customer_addresses_country_not_null`: `NOT NULL country`.
- `customer_addresses_full_name_not_null`: `NOT NULL full_name`.
- `customer_addresses_id_not_null`: `NOT NULL id`.
- `customer_addresses_line1_not_null`: `NOT NULL line1`.
- `customer_addresses_pkey`: `PRIMARY KEY (id)`.
- `customer_addresses_postal_code_not_null`: `NOT NULL postal_code`.
- `customer_addresses_state_not_null`: `NOT NULL state`.
- `customer_addresses_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `customer_addresses_user_id_not_null`: `NOT NULL user_id`.

RLS policies:

- `own_addresses`: ALL; roles authenticated; PERMISSIVE; USING `(user_id = auth.uid())`; WITH CHECK `(user_id = auth.uid())`.

Indexes:

- `CREATE UNIQUE INDEX customer_addresses_pkey ON public.customer_addresses USING btree (id)`;

Triggers:

- None.

## public.inventory

RLS enabled: true; forced: false.

Columns:

- `variant_id`: uuid; NOT NULL; no default.
- `quantity`: int4; NOT NULL; default 0.

Constraints and relationships:

- `inventory_pkey`: `PRIMARY KEY (variant_id)`.
- `inventory_quantity_check`: `CHECK ((quantity >= 0))`.
- `inventory_quantity_not_null`: `NOT NULL quantity`.
- `inventory_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id)`.
- `inventory_variant_id_not_null`: `NOT NULL variant_id`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_inventory`: SELECT; roles public; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM product_variants
  WHERE ((product_variants.id = inventory.variant_id) AND product_variants.active)))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX inventory_pkey ON public.inventory USING btree (variant_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.order_items

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `order_id`: uuid; NOT NULL; no default.
- `variant_id`: uuid; NOT NULL; no default.
- `product_id`: uuid; NOT NULL; no default.
- `product_name`: text; NOT NULL; no default.
- `sku`: text; NOT NULL; no default.
- `variant`: text; NOT NULL; no default.
- `quantity`: int4; NOT NULL; no default.
- `unit_price_cents`: int4; NOT NULL; no default.
- `discount_cents`: int4; NOT NULL; default 0.

Constraints and relationships:

- `order_items_discount_cents_not_null`: `NOT NULL discount_cents`.
- `order_items_id_not_null`: `NOT NULL id`.
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id)`.
- `order_items_order_id_not_null`: `NOT NULL order_id`.
- `order_items_pkey`: `PRIMARY KEY (id)`.
- `order_items_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id)`.
- `order_items_product_id_not_null`: `NOT NULL product_id`.
- `order_items_product_name_not_null`: `NOT NULL product_name`.
- `order_items_quantity_check`: `CHECK (((quantity >= 1) AND (quantity <= 99)))`.
- `order_items_quantity_not_null`: `NOT NULL quantity`.
- `order_items_sku_not_null`: `NOT NULL sku`.
- `order_items_unit_price_cents_not_null`: `NOT NULL unit_price_cents`.
- `order_items_variant_id_fkey`: `FOREIGN KEY (variant_id) REFERENCES product_variants(id)`.
- `order_items_variant_id_not_null`: `NOT NULL variant_id`.
- `order_items_variant_not_null`: `NOT NULL variant`.

RLS policies:

- `read_items`: SELECT; roles authenticated; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_items.order_id) AND ((orders.user_id = auth.uid()) OR is_admin()))))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE INDEX items_order ON public.order_items USING btree (order_id)`;
- `CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (id)`;

Triggers:

- None.

## public.order_status_history

RLS enabled: true; forced: false.

Columns:

- `id`: int8; NOT NULL; identity.
- `order_id`: uuid; NOT NULL; no default.
- `status`: text; NOT NULL; no default.
- `payment_status`: text; NOT NULL; no default.
- `created_at`: timestamptz; nullable; default now().

Constraints and relationships:

- `order_status_history_id_not_null`: `NOT NULL id`.
- `order_status_history_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id)`.
- `order_status_history_order_id_not_null`: `NOT NULL order_id`.
- `order_status_history_payment_status_not_null`: `NOT NULL payment_status`.
- `order_status_history_pkey`: `PRIMARY KEY (id)`.
- `order_status_history_status_not_null`: `NOT NULL status`.

RLS policies:

- `read_history`: SELECT; roles authenticated; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = order_status_history.order_id) AND ((orders.user_id = auth.uid()) OR is_admin()))))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE INDEX history_order ON public.order_status_history USING btree (order_id)`;
- `CREATE UNIQUE INDEX order_status_history_pkey ON public.order_status_history USING btree (id)`;

Triggers:

- None.

## public.orders

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `user_id`: uuid; NOT NULL; no default.
- `request_id`: uuid; NOT NULL; no default.
- `created_at`: timestamptz; nullable; default now().
- `expires_at`: timestamptz; nullable; default (now() + '00:30:00'::interval).
- `shipping_address`: jsonb; NOT NULL; no default.
- `shipping_rule_id`: uuid; nullable; no default.
- `method`: text; NOT NULL; no default.
- `status`: text; NOT NULL; default 'payment_pending'::text.
- `payment_status`: text; NOT NULL; default 'pending'::text.
- `subtotal_cents`: int4; NOT NULL; no default.
- `discount_cents`: int4; NOT NULL; no default.
- `shipping_cents`: int4; NOT NULL; no default.
- `tax_cents`: int4; NOT NULL; no default.
- `total_cents`: int4; NOT NULL; no default.
- `currency`: text; NOT NULL; default 'USD'::text.
- `stock_released`: bool; NOT NULL; default false.
- `carrier`: text; nullable; no default.
- `tracking_number`: text; nullable; no default.

Constraints and relationships:

- `orders_currency_not_null`: `NOT NULL currency`.
- `orders_discount_cents_not_null`: `NOT NULL discount_cents`.
- `orders_id_not_null`: `NOT NULL id`.
- `orders_method_check`: `CHECK ((method = ANY (ARRAY['paypal'::text, 'zelle'::text])))`.
- `orders_method_not_null`: `NOT NULL method`.
- `orders_payment_status_check`: `CHECK ((payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text, 'partially_refunded'::text])))`.
- `orders_payment_status_not_null`: `NOT NULL payment_status`.
- `orders_pkey`: `PRIMARY KEY (id)`.
- `orders_request_id_not_null`: `NOT NULL request_id`.
- `orders_shipping_address_not_null`: `NOT NULL shipping_address`.
- `orders_shipping_cents_not_null`: `NOT NULL shipping_cents`.
- `orders_shipping_rule_id_fkey`: `FOREIGN KEY (shipping_rule_id) REFERENCES shipping_rules(id)`.
- `orders_status_check`: `CHECK ((status = ANY (ARRAY['placed'::text, 'payment_pending'::text, 'payment_verified'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])))`.
- `orders_status_not_null`: `NOT NULL status`.
- `orders_stock_released_not_null`: `NOT NULL stock_released`.
- `orders_subtotal_cents_not_null`: `NOT NULL subtotal_cents`.
- `orders_tax_cents_not_null`: `NOT NULL tax_cents`.
- `orders_total_cents_check`: `CHECK ((total_cents > 0))`.
- `orders_total_cents_not_null`: `NOT NULL total_cents`.
- `orders_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `orders_user_id_not_null`: `NOT NULL user_id`.
- `orders_user_id_request_id_key`: `UNIQUE (user_id, request_id)`.

RLS policies:

- `read_orders`: SELECT; roles authenticated; PERMISSIVE; USING `((user_id = auth.uid()) OR is_admin())`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`;
- `CREATE INDEX orders_user ON public.orders USING btree (user_id, created_at DESC)`;
- `CREATE UNIQUE INDEX orders_user_id_request_id_key ON public.orders USING btree (user_id, request_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION audit_change()`;
- `CREATE TRIGGER checkout_guard BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION validate_order_insert()`;
- `CREATE TRIGGER order_history AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION record_order_status()`;

## public.payments

RLS enabled: true; forced: false.

Columns:

- `order_id`: uuid; NOT NULL; no default.
- `provider_order_id`: text; nullable; no default.
- `capture_id`: text; nullable; no default.
- `reference`: text; nullable; no default.
- `verified_by`: uuid; nullable; no default.
- `verified_at`: timestamptz; nullable; no default.

Constraints and relationships:

- `payments_capture_id_key`: `UNIQUE (capture_id)`.
- `payments_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id)`.
- `payments_order_id_not_null`: `NOT NULL order_id`.
- `payments_pkey`: `PRIMARY KEY (order_id)`.
- `payments_provider_order_id_key`: `UNIQUE (provider_order_id)`.
- `payments_verified_by_fkey`: `FOREIGN KEY (verified_by) REFERENCES auth.users(id)`.

RLS policies:

- `read_payments`: SELECT; roles authenticated; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = payments.order_id) AND ((orders.user_id = auth.uid()) OR is_admin()))))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX payments_capture_id_key ON public.payments USING btree (capture_id)`;
- `CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (order_id)`;
- `CREATE UNIQUE INDEX payments_provider_order_id_key ON public.payments USING btree (provider_order_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.product_variants

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `product_id`: uuid; NOT NULL; no default.
- `sku`: text; NOT NULL; no default.
- `color`: text; NOT NULL; no default.
- `configuration`: text; NOT NULL; no default.
- `price_cents`: int4; NOT NULL; no default.
- `currency`: text; NOT NULL; default 'USD'::text.
- `image_path`: text; nullable; no default.
- `image_source`: text; nullable; no default.
- `image_permission`: text; nullable; no default.
- `image_verified_at`: timestamptz; nullable; no default.
- `specifications`: jsonb; nullable; default '{}'::jsonb.
- `compatible_product_ids`: _uuid; nullable; default '{}'::uuid[].
- `active`: bool; nullable; default false.
- `gallery_paths`: _text; NOT NULL; default '{}'::text[].
- `price_source`: text; nullable; no default.
- `price_verified_at`: timestamptz; nullable; no default.

Constraints and relationships:

- `local_image_path`: `CHECK (((NOT active) OR (image_path ~ '^images/[a-zA-Z0-9/_.-]+\.(webp|avif|png|jpg|jpeg)$'::text)))`.
- `product_variants_check`: `CHECK (((NOT active) OR ((image_path IS NOT NULL) AND (image_permission = 'approved'::text) AND (image_verified_at IS NOT NULL))))`.
- `product_variants_color_not_null`: `NOT NULL color`.
- `product_variants_configuration_not_null`: `NOT NULL configuration`.
- `product_variants_currency_check`: `CHECK ((currency = 'USD'::text))`.
- `product_variants_currency_not_null`: `NOT NULL currency`.
- `product_variants_gallery_paths_not_null`: `NOT NULL gallery_paths`.
- `product_variants_id_not_null`: `NOT NULL id`.
- `product_variants_pkey`: `PRIMARY KEY (id)`.
- `product_variants_price_cents_check`: `CHECK ((price_cents > 0))`.
- `product_variants_price_cents_not_null`: `NOT NULL price_cents`.
- `product_variants_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id)`.
- `product_variants_product_id_not_null`: `NOT NULL product_id`.
- `product_variants_sku_key`: `UNIQUE (sku)`.
- `product_variants_sku_not_null`: `NOT NULL sku`.
- `verified_price`: `CHECK (((NOT active) OR ((NULLIF(price_source, ''::text) IS NOT NULL) AND (price_verified_at IS NOT NULL))))`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_variants`: SELECT; roles public; PERMISSIVE; USING `(active AND (EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_variants.product_id) AND products.published))))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX product_variants_pkey ON public.product_variants USING btree (id)`;
- `CREATE UNIQUE INDEX product_variants_sku_key ON public.product_variants USING btree (sku)`;
- `CREATE INDEX variants_product ON public.product_variants USING btree (product_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.products

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `category_id`: uuid; nullable; no default.
- `name`: text; NOT NULL; no default.
- `brand`: text; NOT NULL; no default.
- `model`: text; NOT NULL; no default.
- `description`: text; NOT NULL; default ''::text.
- `specifications`: jsonb; NOT NULL; default '{}'::jsonb.
- `keywords`: _text; nullable; default '{}'::text[].
- `published`: bool; NOT NULL; default false.
- `featured`: bool; nullable; default false.
- `verification_source`: text; nullable; no default.
- `verified_at`: timestamptz; nullable; no default.
- `created_at`: timestamptz; nullable; default now().
- `product_type`: text; nullable; no default.

Constraints and relationships:

- `products_brand_not_null`: `NOT NULL brand`.
- `products_category_id_fkey`: `FOREIGN KEY (category_id) REFERENCES categories(id)`.
- `products_description_not_null`: `NOT NULL description`.
- `products_id_not_null`: `NOT NULL id`.
- `products_model_not_null`: `NOT NULL model`.
- `products_name_not_null`: `NOT NULL name`.
- `products_pkey`: `PRIMARY KEY (id)`.
- `products_published_not_null`: `NOT NULL published`.
- `products_specifications_not_null`: `NOT NULL specifications`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_products`: SELECT; roles public; PERMISSIVE; USING `published`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE INDEX products_category ON public.products USING btree (category_id) WHERE published`;
- `CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)`;
- `CREATE INDEX products_search ON public.products USING gin (to_tsvector('english'::regconfig, ((((name || ' '::text) || brand) || ' '::text) || model)))`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION audit_change()`;
- `CREATE TRIGGER verify_publication BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION guard_product_publication()`;

## public.profiles

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; no default.
- `display_name`: text; nullable; no default.

Constraints and relationships:

- `profiles_display_name_check`: `CHECK ((length(display_name) <= 80))`.
- `profiles_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id)`.
- `profiles_id_not_null`: `NOT NULL id`.
- `profiles_pkey`: `PRIMARY KEY (id)`.

RLS policies:

- `own_profile`: ALL; roles authenticated; PERMISSIVE; USING `(id = auth.uid())`; WITH CHECK `(id = auth.uid())`.

Indexes:

- `CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)`;

Triggers:

- None.

## public.promotion_products

RLS enabled: true; forced: false.

Columns:

- `promotion_id`: uuid; NOT NULL; no default.
- `product_id`: uuid; NOT NULL; no default.

Constraints and relationships:

- `promotion_products_pkey`: `PRIMARY KEY (promotion_id, product_id)`.
- `promotion_products_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id)`.
- `promotion_products_product_id_not_null`: `NOT NULL product_id`.
- `promotion_products_promotion_id_fkey`: `FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE`.
- `promotion_products_promotion_id_not_null`: `NOT NULL promotion_id`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_promotion_items`: SELECT; roles public; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM promotions
  WHERE ((promotions.id = promotion_products.promotion_id) AND promotions.active)))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX promotion_products_pkey ON public.promotion_products USING btree (promotion_id, product_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.promotion_products FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.promotions

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `name`: text; NOT NULL; no default.
- `kind`: text; nullable; no default.
- `minimum_quantity`: int4; NOT NULL; default 1.
- `percent_basis_points`: int4; NOT NULL; no default.
- `starts_at`: timestamptz; NOT NULL; no default.
- `ends_at`: timestamptz; NOT NULL; no default.
- `active`: bool; nullable; default false.
- `combination_rule`: text; NOT NULL; default 'exclusive'::text.
- `discount_cents`: int4; NOT NULL; default 0.

Constraints and relationships:

- `one_discount_type`: `CHECK (((percent_basis_points = 0) OR (discount_cents = 0)))`.
- `promotions_check`: `CHECK ((ends_at > starts_at))`.
- `promotions_combination_rule_check`: `CHECK ((combination_rule = 'exclusive'::text))`.
- `promotions_combination_rule_not_null`: `NOT NULL combination_rule`.
- `promotions_discount_cents_check`: `CHECK ((discount_cents >= 0))`.
- `promotions_discount_cents_not_null`: `NOT NULL discount_cents`.
- `promotions_ends_at_not_null`: `NOT NULL ends_at`.
- `promotions_id_not_null`: `NOT NULL id`.
- `promotions_kind_check`: `CHECK ((kind = ANY (ARRAY['quantity'::text, 'bundle'::text])))`.
- `promotions_minimum_quantity_check`: `CHECK ((minimum_quantity > 0))`.
- `promotions_minimum_quantity_not_null`: `NOT NULL minimum_quantity`.
- `promotions_name_not_null`: `NOT NULL name`.
- `promotions_percent_basis_points_check`: `CHECK (((percent_basis_points >= 0) AND (percent_basis_points <= 10000)))`.
- `promotions_percent_basis_points_not_null`: `NOT NULL percent_basis_points`.
- `promotions_pkey`: `PRIMARY KEY (id)`.
- `promotions_starts_at_not_null`: `NOT NULL starts_at`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_promotions`: SELECT; roles public; PERMISSIVE; USING `(active AND ((now() >= starts_at) AND (now() <= ends_at)))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX promotions_pkey ON public.promotions USING btree (id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.refunds

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `order_id`: uuid; NOT NULL; no default.
- `requested_by`: uuid; NOT NULL; no default.
- `amount_cents`: int4; NOT NULL; no default.
- `currency`: text; NOT NULL; no default.
- `provider_refund_id`: text; nullable; no default.
- `status`: text; NOT NULL; default 'processing'::text.
- `bank_reference`: text; nullable; no default.
- `created_at`: timestamptz; nullable; default now().
- `completed_at`: timestamptz; nullable; no default.

Constraints and relationships:

- `refunds_amount_cents_check`: `CHECK ((amount_cents > 0))`.
- `refunds_amount_cents_not_null`: `NOT NULL amount_cents`.
- `refunds_currency_check`: `CHECK ((currency = 'USD'::text))`.
- `refunds_currency_not_null`: `NOT NULL currency`.
- `refunds_id_not_null`: `NOT NULL id`.
- `refunds_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id)`.
- `refunds_order_id_key`: `UNIQUE (order_id)`.
- `refunds_order_id_not_null`: `NOT NULL order_id`.
- `refunds_pkey`: `PRIMARY KEY (id)`.
- `refunds_provider_refund_id_key`: `UNIQUE (provider_refund_id)`.
- `refunds_requested_by_fkey`: `FOREIGN KEY (requested_by) REFERENCES auth.users(id)`.
- `refunds_requested_by_not_null`: `NOT NULL requested_by`.
- `refunds_status_check`: `CHECK ((status = ANY (ARRAY['processing'::text, 'pending'::text, 'completed'::text])))`.
- `refunds_status_not_null`: `NOT NULL status`.

RLS policies:

- `read_own_refunds`: SELECT; roles authenticated; PERMISSIVE; USING `(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = refunds.order_id) AND ((orders.user_id = auth.uid()) OR is_admin()))))`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX refunds_order_id_key ON public.refunds USING btree (order_id)`;
- `CREATE UNIQUE INDEX refunds_pkey ON public.refunds USING btree (id)`;
- `CREATE UNIQUE INDEX refunds_provider_refund_id_key ON public.refunds USING btree (provider_refund_id)`;

Triggers:

- `CREATE TRIGGER refund_audit AFTER INSERT OR UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.request_limits

RLS enabled: true; forced: false.

Columns:

- `user_id`: uuid; NOT NULL; no default.
- `window_start`: timestamptz; NOT NULL; default now().
- `requests`: int4; NOT NULL; default 1.

Constraints and relationships:

- `request_limits_pkey`: `PRIMARY KEY (user_id)`.
- `request_limits_requests_not_null`: `NOT NULL requests`.
- `request_limits_user_id_not_null`: `NOT NULL user_id`.
- `request_limits_window_start_not_null`: `NOT NULL window_start`.

RLS policies:

- No client policies; RLS defaults to deny for non-bypass roles.

Indexes:

- `CREATE UNIQUE INDEX request_limits_pkey ON public.request_limits USING btree (user_id)`;

Triggers:

- None.

## public.review_reports

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `review_id`: uuid; nullable; no default.
- `user_id`: uuid; nullable; default auth.uid().
- `reason`: text; NOT NULL; no default.

Constraints and relationships:

- `review_reports_id_not_null`: `NOT NULL id`.
- `review_reports_pkey`: `PRIMARY KEY (id)`.
- `review_reports_reason_check`: `CHECK (((length(reason) >= 5) AND (length(reason) <= 500)))`.
- `review_reports_reason_not_null`: `NOT NULL reason`.
- `review_reports_review_id_fkey`: `FOREIGN KEY (review_id) REFERENCES reviews(id)`.
- `review_reports_review_id_user_id_key`: `UNIQUE (review_id, user_id)`.
- `review_reports_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.

RLS policies:

- `admin_reports`: SELECT; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.
- `own_reports`: INSERT; roles authenticated; PERMISSIVE; USING `(not applicable)`; WITH CHECK `(user_id = auth.uid())`.

Indexes:

- `CREATE UNIQUE INDEX review_reports_pkey ON public.review_reports USING btree (id)`;
- `CREATE UNIQUE INDEX review_reports_review_id_user_id_key ON public.review_reports USING btree (review_id, user_id)`;

Triggers:

- None.

## public.reviews

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `user_id`: uuid; NOT NULL; default auth.uid().
- `product_id`: uuid; NOT NULL; no default.
- `rating`: int4; NOT NULL; no default.
- `body`: text; NOT NULL; no default.
- `display_name`: text; NOT NULL; no default.
- `approved`: bool; NOT NULL; default false.
- `created_at`: timestamptz; nullable; default now().

Constraints and relationships:

- `reviews_approved_not_null`: `NOT NULL approved`.
- `reviews_body_check`: `CHECK (((length(body) >= 10) AND (length(body) <= 3000)))`.
- `reviews_body_not_null`: `NOT NULL body`.
- `reviews_display_name_check`: `CHECK (((length(display_name) >= 1) AND (length(display_name) <= 80)))`.
- `reviews_display_name_not_null`: `NOT NULL display_name`.
- `reviews_id_not_null`: `NOT NULL id`.
- `reviews_pkey`: `PRIMARY KEY (id)`.
- `reviews_product_id_fkey`: `FOREIGN KEY (product_id) REFERENCES products(id)`.
- `reviews_product_id_not_null`: `NOT NULL product_id`.
- `reviews_rating_check`: `CHECK (((rating >= 1) AND (rating <= 5)))`.
- `reviews_rating_not_null`: `NOT NULL rating`.
- `reviews_user_id_fkey`: `FOREIGN KEY (user_id) REFERENCES auth.users(id)`.
- `reviews_user_id_not_null`: `NOT NULL user_id`.
- `reviews_user_id_product_id_key`: `UNIQUE (user_id, product_id)`.

RLS policies:

- `moderate_reviews`: UPDATE; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `read_reviews`: SELECT; roles public; PERMISSIVE; USING `(approved OR (user_id = auth.uid()) OR is_admin())`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id)`;
- `CREATE INDEX reviews_product ON public.reviews USING btree (product_id, approved)`;
- `CREATE UNIQUE INDEX reviews_user_id_product_id_key ON public.reviews USING btree (user_id, product_id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.shipping_rules

RLS enabled: true; forced: false.

Columns:

- `id`: uuid; NOT NULL; default gen_random_uuid().
- `country`: text; NOT NULL; no default.
- `state`: text; NOT NULL; no default.
- `method`: text; NOT NULL; no default.
- `price_cents`: int4; NOT NULL; no default.
- `tax_basis_points`: int4; nullable; no default.
- `approved`: bool; NOT NULL; default false.
- `delivery_description`: text; NOT NULL; no default.
- `free_over_cents`: int4; nullable; no default.

Constraints and relationships:

- `shipping_rules_approved_not_null`: `NOT NULL approved`.
- `shipping_rules_country_not_null`: `NOT NULL country`.
- `shipping_rules_delivery_description_not_null`: `NOT NULL delivery_description`.
- `shipping_rules_id_not_null`: `NOT NULL id`.
- `shipping_rules_method_not_null`: `NOT NULL method`.
- `shipping_rules_pkey`: `PRIMARY KEY (id)`.
- `shipping_rules_price_cents_check`: `CHECK ((price_cents >= 0))`.
- `shipping_rules_price_cents_not_null`: `NOT NULL price_cents`.
- `shipping_rules_state_not_null`: `NOT NULL state`.
- `shipping_rules_tax_basis_points_check`: `CHECK (((tax_basis_points >= 0) AND (tax_basis_points <= 10000)))`.

RLS policies:

- `admin_manage`: ALL; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_shipping`: SELECT; roles public; PERMISSIVE; USING `approved`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX shipping_rules_pkey ON public.shipping_rules USING btree (id)`;

Triggers:

- `CREATE TRIGGER audit AFTER INSERT OR DELETE OR UPDATE ON public.shipping_rules FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.store_settings

RLS enabled: true; forced: false.

Columns:

- `id`: bool; NOT NULL; default true.
- `checkout_enabled`: bool; NOT NULL; default false.
- `policies_approved`: bool; NOT NULL; default false.
- `max_open_reservations`: int4; NOT NULL; default 5.

Constraints and relationships:

- `store_settings_checkout_enabled_not_null`: `NOT NULL checkout_enabled`.
- `store_settings_id_check`: `CHECK (id)`.
- `store_settings_id_not_null`: `NOT NULL id`.
- `store_settings_max_open_reservations_check`: `CHECK (((max_open_reservations >= 1) AND (max_open_reservations <= 50)))`.
- `store_settings_max_open_reservations_not_null`: `NOT NULL max_open_reservations`.
- `store_settings_pkey`: `PRIMARY KEY (id)`.
- `store_settings_policies_approved_not_null`: `NOT NULL policies_approved`.

RLS policies:

- `admin_settings`: UPDATE; roles authenticated; PERMISSIVE; USING `is_admin()`; WITH CHECK `is_admin()`.
- `public_settings`: SELECT; roles public; PERMISSIVE; USING `true`; WITH CHECK `(implicit USING for ALL/UPDATE; otherwise not applicable)`.

Indexes:

- `CREATE UNIQUE INDEX store_settings_pkey ON public.store_settings USING btree (id)`;

Triggers:

- `CREATE TRIGGER launch_settings_audit AFTER UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION audit_change()`;

## public.webhook_events

RLS enabled: true; forced: false.

Columns:

- `id`: text; NOT NULL; no default.
- `created_at`: timestamptz; nullable; default now().

Constraints and relationships:

- `webhook_events_id_not_null`: `NOT NULL id`.
- `webhook_events_pkey`: `PRIMARY KEY (id)`.

RLS policies:

- No client policies; RLS defaults to deny for non-bypass roles.

Indexes:

- `CREATE UNIQUE INDEX webhook_events_pkey ON public.webhook_events USING btree (id)`;

Triggers:

- None.

## Final function definitions

### admin_order(uuid,text,text,text)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.admin_order(p_id uuid, p_action text, p_value text DEFAULT ''::text, p_carrier text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o orders;
begin
  if not is_admin() then raise exception 'Admin MFA required';end if;
  select * into o from orders where id=p_id for update;
  if not found then raise exception 'Order not found';end if;
  if p_action='verify_zelle' then
    if o.method<>'zelle' or coalesce(length(trim(p_value)),0)<5 then raise exception 'Bank receipt reference required';end if;
    perform confirm_payment(p_id,'zelle:'||trim(p_value),o.total_cents,o.currency,auth.uid());
  elsif p_action='cancel' then
    if o.payment_status not in ('pending','failed','cancelled') then raise exception 'Reconcile payment or refund before cancellation';end if;
    perform release_order(p_id);
  elsif p_action in ('processing','shipped','delivered') then
    if o.payment_status<>'paid'
       or (p_action='processing' and o.status<>'payment_verified')
       or (p_action='shipped' and (o.status<>'processing' or coalesce(length(trim(p_value)),0)<3 or coalesce(length(trim(p_carrier)),0)<2))
       or (p_action='delivered' and o.status<>'shipped') then raise exception 'Invalid order transition';end if;
    update orders set status=p_action,
      tracking_number=case when p_action='shipped' then trim(p_value) else tracking_number end,
      carrier=case when p_action='shipped' then trim(p_carrier) else carrier end where id=p_id;
  else raise exception 'Unsupported action';end if;
  insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),p_action,p_id::text);
end$function$

```

### admin_store_summary()

Returns jsonb; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.admin_store_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 return jsonb_build_object(
  'orders',(select count(*) from orders),
  'pending_payments',(select count(*) from orders where payment_status in ('pending','processing')),
  'paid_orders',(select count(*) from orders where payment_status='paid'),
  'processing',(select count(*) from orders where status='processing'),
  'shipped',(select count(*) from orders where status='shipped'),
  'delivered',(select count(*) from orders where status='delivered'),
  'cancelled',(select count(*) from orders where status='cancelled'),
  'products',(select count(*) from products),
  'published_products',(select count(*) from products where published),
  'available_units',(select coalesce(sum(quantity),0) from inventory),
  'captured_cents',(select coalesce(sum(total_cents),0) from orders where payment_status in ('paid','refunded','partially_refunded')),
  'refunded_cents',(select coalesce(sum(amount_cents),0) from refunds where status='completed'),
  'pending_reviews',(select count(*) from reviews where not approved),
  'open_messages',(select count(*) from contact_messages where not handled),
  'reconciliation_alerts',(select count(*) from admin_audit_logs where outcome='attention_required')
 );
end$function$

```

### audit_change()

Returns trigger; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.audit_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),tg_table_name||':'||tg_op,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'variant_id')); return coalesce(new,old);end$function$

```

### begin_capture(uuid)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.begin_capture(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare o orders;begin select * into o from orders where id=p_id for update;if not found or o.method<>'paypal' or o.stock_released or o.payment_status not in ('pending','processing') or o.expires_at<=now() then raise exception 'Reservation unavailable or expired';end if;update orders set payment_status='processing' where id=p_id;end$function$

```

### confirm_payment(uuid,text,integer,text,uuid)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.confirm_payment(p_id uuid, p_capture text, p_amount integer, p_currency text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o orders; existing_capture text;
begin
  select * into o from orders where id=p_id for update;
  if not found or p_amount is null or p_currency is null or coalesce(length(p_capture),0)<1
     or o.total_cents<>p_amount or o.currency<>p_currency then
    raise exception 'Payment mismatch';
  end if;
  select capture_id into existing_capture from payments where order_id=p_id;
  if o.payment_status in ('paid','refunded','partially_refunded') then
    if existing_capture=p_capture then return; end if;
    raise exception 'Duplicate payment mismatch';
  end if;
  if o.stock_released or o.payment_status='cancelled' then
    raise exception 'Reservation released: manual reconciliation required';
  end if;
  if existing_capture is not null and existing_capture<>p_capture then raise exception 'Capture identity mismatch';end if;
  update payments set capture_id=p_capture,verified_by=p_actor,verified_at=now() where order_id=p_id;
  if not found then raise exception 'Missing payment record';end if;
  update orders set payment_status='paid',status='payment_verified' where id=p_id;
  insert into admin_audit_logs(actor,action,record_id) values(p_actor,'payment_verified',p_id::text);
end$function$

```

### expire_reservations()

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.expire_reservations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare o record;begin for o in select id from orders where expires_at<now() and payment_status='pending' and not stock_released loop perform release_order(o.id);end loop;end$function$

```

### finish_paypal_refund(uuid,text,integer,text,boolean)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.finish_paypal_refund(p_refund uuid, p_provider_id text, p_amount integer, p_currency text, p_completed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare r public.refunds;begin
 if p_amount is null or p_currency is null or p_completed is null or nullif(trim(p_provider_id),'') is null then raise exception 'Refund proof required';end if;
 select * into r from public.refunds where id=p_refund for update;
 if not found or r.amount_cents is distinct from p_amount or r.currency is distinct from p_currency then raise exception 'Refund mismatch';end if;
 if not exists(select 1 from public.orders where id=r.order_id and method='paypal') then raise exception 'PayPal refund required';end if;
 if r.provider_refund_id is not null and r.provider_refund_id<>p_provider_id then raise exception 'Refund identity mismatch';end if;
 if r.status='completed' then return;end if;
 update public.refunds set provider_refund_id=p_provider_id,status=case when p_completed then 'completed' else 'pending' end,completed_at=case when p_completed then now() else null end where id=p_refund;
 if p_completed then update public.orders set payment_status='refunded' where id=r.order_id;end if;
 insert into public.admin_audit_logs(actor,action,record_id) values(r.requested_by,'paypal_refund_'||case when p_completed then 'completed' else 'pending' end,r.order_id::text);
end$function$

```

### guard_product_publication()

Returns trigger; SECURITY INVOKER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.guard_product_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$begin if new.published and (nullif(new.verification_source,'') is null or new.verified_at is null) then raise exception 'Verified product source required';end if;return new;end$function$

```

### is_admin()

Returns boolean; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=true, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists(select 1 from admin_members where user_id=auth.uid()) and coalesce(auth.jwt()->>'aal','')='aal2' $function$

```

### limit_request(uuid)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.limit_request(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare n integer;begin insert into request_limits(user_id) values(p_user) on conflict(user_id) do update set requests=case when request_limits.window_start<now()-interval '1 minute' then 1 else request_limits.requests+1 end,window_start=case when request_limits.window_start<now()-interval '1 minute' then now() else request_limits.window_start end returning requests into n;if n>30 then raise exception 'Too many requests';end if;end$function$

```

### place_order(jsonb,jsonb,uuid,text,uuid)

Returns uuid; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_address jsonb, p_shipping uuid, p_method text, p_request uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare oid uuid; line record; sub bigint:=0; disc bigint:=0; ship integer; tax integer; rule shipping_rules; promo promotions; eligible bigint; candidate bigint; count_items integer; best_promo uuid; winning_eligible bigint; begin
 if auth.uid() is null then raise exception 'Sign in before checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select id into oid from orders where user_id=auth.uid() and request_id=p_request;if found then return oid;end if;
 perform limit_request(auth.uid());
 if (select count(*) from orders where user_id=auth.uid() and not stock_released and payment_status in ('pending','processing')) >= (select max_open_reservations from store_settings where id=true) then raise exception 'Too many unpaid reservations; finish or cancel an existing order';end if;
 if p_method is null or p_items is null or p_method not in ('paypal','zelle') or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 if length(p_address->>'full_name') not between 1 and 100 or length(p_address->>'line1') not between 1 and 200 or length(p_address->>'city') not between 1 and 100 or length(p_address->>'postal_code') not between 1 and 20 or p_address->>'country' is null or p_address->>'state' is null then raise exception 'Complete shipping address required';end if;
 select * into rule from shipping_rules where id=p_shipping and approved and country=p_address->>'country' and state=p_address->>'state';
 if not found or rule.tax_basis_points is null then raise exception 'Shipping or approved tax configuration unavailable';end if;
 if exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99 or variant_id is null) then raise exception 'Invalid quantities';end if;
 if (select count(distinct x.variant_id) from jsonb_to_recordset(p_items) as x(variant_id uuid))<>jsonb_array_length(p_items) then raise exception 'Duplicate variants';end if;
 perform p.id from products p where p.id in (select v.product_id from product_variants v join jsonb_to_recordset(p_items) as x(variant_id uuid) on x.variant_id=v.id) order by p.id for share;
 for line in select v.*,i.quantity as stock,x.quantity as requested,p.name,p.published from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id join products p on p.id=v.product_id order by v.id for update of i,v loop
 if not line.active or not line.published or line.stock<line.requested then raise exception 'Product unavailable or insufficient inventory';end if;sub:=sub+line.price_cents::bigint*line.requested;end loop;
 select count(*) into count_items from jsonb_to_recordset(p_items) as x(variant_id uuid) join product_variants v on v.id=x.variant_id join inventory i on i.variant_id=v.id;
 if count_items<>jsonb_array_length(p_items) then raise exception 'Unknown product';end if;
 for promo in select * from promotions where active and now() between starts_at and ends_at loop
 select coalesce(sum(v.price_cents::bigint*x.quantity),0) into eligible from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id;
 if promo.kind='quantity' and (select coalesce(sum(x.quantity),0) from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join promotion_products pp on pp.product_id=v.product_id and pp.promotion_id=promo.id)<promo.minimum_quantity then continue;end if;
 if promo.kind='bundle' and (not exists(select 1 from promotion_products where promotion_id=promo.id) or exists(select 1 from promotion_products pp where pp.promotion_id=promo.id and not exists(select 1 from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id where v.product_id=pp.product_id group by v.product_id having sum(x.quantity)>=promo.minimum_quantity))) then continue;end if;
 candidate:=least(eligible,case when promo.discount_cents>0 then promo.discount_cents else floor(eligible*promo.percent_basis_points/10000.0) end);if candidate>disc then disc:=candidate;best_promo:=promo.id;winning_eligible:=eligible;end if;end loop;
 ship:=case when rule.free_over_cents is not null and sub-disc>=rule.free_over_cents then 0 else rule.price_cents end;tax:=round((sub-disc+ship)*rule.tax_basis_points/10000.0);
 insert into orders(user_id,request_id,shipping_address,shipping_rule_id,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents) values(auth.uid(),p_request,p_address,p_shipping,p_method,sub,disc,ship,tax,sub-disc+ship+tax) returning id into oid;
 insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents) select oid,v.id,p.id,p.name,v.sku,v.color||' / '||v.configuration,x.quantity,v.price_cents from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) join product_variants v on v.id=x.variant_id join products p on p.id=v.product_id;
 if disc>0 then with allocations as (select oi.id, floor(sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)*disc/winning_eligible::numeric)-floor((sum(oi.unit_price_cents::bigint*oi.quantity) over(order by oi.id)-oi.unit_price_cents::bigint*oi.quantity)*disc/winning_eligible::numeric) as amount from order_items oi where oi.order_id=oid and exists(select 1 from promotion_products pp where pp.promotion_id=best_promo and pp.product_id=oi.product_id)) update order_items oi set discount_cents=a.amount from allocations a where oi.id=a.id;end if;
 update inventory i set quantity=i.quantity-x.quantity from jsonb_to_recordset(p_items) as x(variant_id uuid,quantity integer) where i.variant_id=x.variant_id;
 insert into payments(order_id) values(oid);return oid;
end$function$

```

### record_order_status()

Returns trigger; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.record_order_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin if tg_op='INSERT' or new.status is distinct from old.status or new.payment_status is distinct from old.payment_status then insert into order_status_history(order_id,status,payment_status) values(new.id,new.status,new.payment_status);end if;return new;end$function$

```

### release_order(uuid)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=true.

```sql
CREATE OR REPLACE FUNCTION public.release_order(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare o orders;
begin
  select * into o from orders where id=p_id for update;
  -- Recheck after locking: a concurrent capture may have begun since expiry selection.
  if not found or o.stock_released or o.payment_status not in ('pending','failed','cancelled') then return;end if;
  update inventory i set quantity=i.quantity+x.quantity from order_items x where x.order_id=p_id and x.variant_id=i.variant_id;
  update orders set stock_released=true,status='cancelled',payment_status='cancelled' where id=p_id;
end$function$

```

### request_full_refund(uuid,text)

Returns uuid; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.request_full_refund(p_id uuid, p_bank_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare o orders;r refunds;begin
 if not is_admin() then raise exception 'Admin MFA required';end if;
 select * into o from orders where id=p_id for update;if not found or o.payment_status not in ('paid','refunded') then raise exception 'Verified payment required';end if;
 select * into r from refunds where order_id=p_id;if found then return r.id;end if;
 if o.method='zelle' and coalesce(length(p_bank_reference),0)<5 then raise exception 'Actual bank refund reference required';end if;
 insert into refunds(order_id,requested_by,amount_cents,currency,bank_reference,status,completed_at) values(o.id,auth.uid(),o.total_cents,o.currency,case when o.method='zelle' then p_bank_reference else null end,case when o.method='zelle' then 'completed' else 'processing' end,case when o.method='zelle' then now() else null end) returning id into r.id;
 if o.method='zelle' then update orders set payment_status='refunded' where id=p_id;end if;
 insert into admin_audit_logs(actor,action,record_id) values(auth.uid(),'full_refund_requested',p_id::text);return r.id;end$function$

```

### send_contact(text,text)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.send_contact(p_subject text, p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin if auth.uid() is null then raise exception 'Sign in to send a message';end if;perform limit_request(auth.uid());insert into contact_messages(user_id,subject,message) values(auth.uid(),p_subject,p_message);end$function$

```

### submit_review(uuid,integer,text,text)

Returns void; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=true, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.submit_review(p_product uuid, p_rating integer, p_body text, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin if not exists(select 1 from orders o join order_items i on i.order_id=o.id where o.user_id=auth.uid() and o.payment_status='paid' and i.product_id=p_product) then raise exception 'A verified purchase is required';end if;insert into reviews(user_id,product_id,rating,body,display_name) values(auth.uid(),p_product,p_rating,p_body,p_name) on conflict(user_id,product_id) do update set rating=excluded.rating,body=excluded.body,display_name=excluded.display_name,approved=false;end$function$

```

### validate_order_insert()

Returns trigger; SECURITY DEFINER; search_path=public, pg_temp. Effective EXECUTE in the broad-default simulation: anon=false, authenticated=false, service_role=false.

```sql
CREATE OR REPLACE FUNCTION public.validate_order_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$begin
 if not exists(select 1 from store_settings where checkout_enabled and policies_approved) then raise exception 'Checkout is awaiting owner approval';end if;
 if coalesce(length(new.shipping_address->>'full_name'),0) not between 1 and 100 or coalesce(length(new.shipping_address->>'line1'),0) not between 1 and 200 or coalesce(length(new.shipping_address->>'city'),0) not between 1 and 100 or coalesce(length(new.shipping_address->>'postal_code'),0) not between 1 and 20 then raise exception 'Complete shipping address required';end if;
 return new;end$function$

```

## Effective table grants in the broad-default simulation

These are local simulation results, not observed hosted privileges. Full role/table/privilege tuples are in catalogue.json.


The corrected installer leaves zero client TRUNCATE grants in this simulation. See tests/installer.test.mjs for active-event-trigger, permission-denial and preservation checks.
