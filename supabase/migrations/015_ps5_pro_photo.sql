begin;
set local lock_timeout = '5s';

-- Standard PS5 Pro exterior, documented in the internal image manifest.
update public.product_variants v
set image_path = 'images/products/ps5-pro-2tb-960.webp',
    image_source = 'https://commons.wikimedia.org/wiki/File:PlayStation_5_Pro_no_disc_drive.jpg',
    image_permission = 'approved', image_verified_at = date '2026-11-09'
from public.products p
where v.product_id = p.id and p.catalogue_key = 'ps5-pro-2tb'
  and v.configuration = 'Standard configuration' and v.color = 'Colour to confirm'
  and v.image_path is null and v.image_permission is distinct from 'approved';

commit;
