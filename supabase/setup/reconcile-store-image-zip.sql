begin;
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('electronics-catalogue-import',0));

-- Each UUID and key must match the existing catalogue before publication changes.
create temporary table reviewed_zip_media on commit drop as
select * from jsonb_to_recordset($store_zip$
[{"product_id":"26408392-8c5e-8406-8878-419fa9f8d361","id":"1a4e671b-126b-84e5-8c7a-b939968daada","key":"airpods-5/White/Charging case option pending","main":"images/products/owner-airpods-5-white-27e51ba62e2afe06-960.webp","gallery":["images/products/owner-airpods-5-white-7e49eb639ac68ec2-960.webp"]},
{"product_id":"a15d4f8d-f242-8685-90ac-1643a1004a0c","id":"6915b457-d871-8630-b390-b35729630ee4","key":"airpods-pro-3/White/Standard configuration","main":"images/products/owner-airpods-pro-3-white-35aee945c7be91ed-960.webp","gallery":["images/products/owner-airpods-pro-3-white-94d9f7bdcc5a3a5d-960.webp","images/products/owner-airpods-pro-3-white-98958645344f2591-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"b5219c26-0e43-86f3-8ad1-0e07e7f6949a","key":"iphone-16/Black/128GB","main":"images/products/owner-iphone-16-c91b259d2951833f.webp","gallery":["images/products/owner-iphone-16-black-11e528837b26a3f4-960.webp","images/products/owner-iphone-16-black-c619161110c17bf4-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"7e39a55c-36aa-85ba-b213-81a7e53a4dfe","key":"iphone-16/Black/256GB","main":"images/products/owner-iphone-16-c91b259d2951833f.webp","gallery":["images/products/owner-iphone-16-black-11e528837b26a3f4-960.webp","images/products/owner-iphone-16-black-c619161110c17bf4-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"8d8cca99-12b6-8097-b903-39de5001d114","key":"iphone-16/Pink/128GB","main":"images/products/owner-iphone-16-pink-644413691842dde9-960.webp","gallery":["images/products/owner-iphone-16-pink-946c645b78b2da6a-960.webp","images/products/owner-iphone-16-pink-a8c69ae5f0ab565f-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"b9c8a25f-2a72-80f7-bea7-d07336086ab2","key":"iphone-16/Pink/256GB","main":"images/products/owner-iphone-16-pink-644413691842dde9-960.webp","gallery":["images/products/owner-iphone-16-pink-946c645b78b2da6a-960.webp","images/products/owner-iphone-16-pink-a8c69ae5f0ab565f-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"7aab3d02-43a6-8e4c-9509-2aa077c73e73","key":"iphone-16/Teal/128GB","main":"images/products/owner-iphone-16-teal-b71cb00c4cb48358-960.webp","gallery":["images/products/owner-iphone-16-teal-31816583915ed0e1-960.webp","images/products/owner-iphone-16-teal-1ad1a81fab2cd47a-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"4c59e104-badb-8023-b972-3493b29c4b14","key":"iphone-16/Teal/256GB","main":"images/products/owner-iphone-16-teal-b71cb00c4cb48358-960.webp","gallery":["images/products/owner-iphone-16-teal-31816583915ed0e1-960.webp","images/products/owner-iphone-16-teal-1ad1a81fab2cd47a-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"acbe732e-7327-8b6c-80a2-7207a1fbc68e","key":"iphone-16/Ultramarine/128GB","main":"images/products/owner-iphone-16-ultramarine-055b2cf3d75bbcc9-960.webp","gallery":["images/products/owner-iphone-16-ultramarine-990c698c1124f2b5-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"b02bad8a-ff6a-80b0-bec1-ab3ca1eab3c4","key":"iphone-16/Ultramarine/256GB","main":"images/products/owner-iphone-16-ultramarine-055b2cf3d75bbcc9-960.webp","gallery":["images/products/owner-iphone-16-ultramarine-990c698c1124f2b5-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"c46cf2ff-4949-8bb1-9162-a6548f958a63","key":"iphone-16/White/128GB","main":"images/products/owner-iphone-16-white-000e9191ffe9568b-960.webp","gallery":["images/products/owner-iphone-16-white-e2d4a0ec993bbdcf-960.webp","images/products/owner-iphone-16-white-7410209e8af4a841-960.webp"]},
{"product_id":"3413cf8d-7212-8cfa-a708-1086dce0febd","id":"062860a7-d344-800b-b2df-ab8c575a8bf0","key":"iphone-16/White/256GB","main":"images/products/owner-iphone-16-white-000e9191ffe9568b-960.webp","gallery":["images/products/owner-iphone-16-white-e2d4a0ec993bbdcf-960.webp","images/products/owner-iphone-16-white-7410209e8af4a841-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"54ebfd3c-2fb7-863d-9395-31099cc61113","key":"iphone-17/Black/256GB","main":"images/products/owner-iphone-17-black-9cad583bea888958-960.webp","gallery":["images/products/owner-iphone-17-black-6bcc5fd3b9a39bc2-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"ceb8413e-e530-8536-96d1-e79a5ab19ee2","key":"iphone-17/Black/512GB","main":"images/products/owner-iphone-17-black-9cad583bea888958-960.webp","gallery":["images/products/owner-iphone-17-black-6bcc5fd3b9a39bc2-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"a0fd0ae7-6ffe-8fc6-9eb7-cfaa449aad43","key":"iphone-17/Lavender/256GB","main":"images/products/owner-iphone-17-lavender-9b977fa47be19d2b-960.webp","gallery":["images/products/owner-iphone-17-f04415251b8c254a.webp","images/products/owner-iphone-17-lavender-531ecae16f8a4071-960.webp","images/products/owner-iphone-17-lavender-ed062bc7dbcd3596-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"bc079164-9e85-8917-93d4-2eba14781fc3","key":"iphone-17/Lavender/512GB","main":"images/products/owner-iphone-17-lavender-9b977fa47be19d2b-960.webp","gallery":["images/products/owner-iphone-17-f04415251b8c254a.webp","images/products/owner-iphone-17-lavender-531ecae16f8a4071-960.webp","images/products/owner-iphone-17-lavender-ed062bc7dbcd3596-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"d9ecafc5-8297-8e0e-9160-2c6821adb4fa","key":"iphone-17/Mist Blue/256GB","main":"images/products/owner-iphone-17-mist-blue-70b9934a0220ed9c-960.webp","gallery":["images/products/owner-iphone-17-mist-blue-9e241efe48c83e83-960.webp","images/products/owner-iphone-17-mist-blue-195c4b4034924468-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"202844e4-c452-88a9-987c-a98e2a71e37a","key":"iphone-17/Mist Blue/512GB","main":"images/products/owner-iphone-17-mist-blue-70b9934a0220ed9c-960.webp","gallery":["images/products/owner-iphone-17-mist-blue-9e241efe48c83e83-960.webp","images/products/owner-iphone-17-mist-blue-195c4b4034924468-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"450acd75-c5ec-8994-b018-b07415c88064","key":"iphone-17/Sage/256GB","main":"images/products/owner-iphone-17-sage-c5167023c1ee687d-960.webp","gallery":["images/products/owner-iphone-17-sage-40e3030e259b1513-960.webp","images/products/owner-iphone-17-sage-ccd17be28e6d7f3f-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"2d733b39-3f07-83d9-ad8f-734142c2f370","key":"iphone-17/Sage/512GB","main":"images/products/owner-iphone-17-sage-c5167023c1ee687d-960.webp","gallery":["images/products/owner-iphone-17-sage-40e3030e259b1513-960.webp","images/products/owner-iphone-17-sage-ccd17be28e6d7f3f-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"60e88a23-4cc4-8984-b5a2-68aad20ed87c","key":"iphone-17/White/256GB","main":"images/products/owner-iphone-17-white-98c3d5aa9241e478-960.webp","gallery":["images/products/owner-iphone-17-white-8fe0d39e87e39555-960.webp"]},
{"product_id":"7331a08f-c08e-828a-884a-55ade6c17e13","id":"0250a574-ab8a-82c9-a7fd-ff40cb1ef605","key":"iphone-17/White/512GB","main":"images/products/owner-iphone-17-white-98c3d5aa9241e478-960.webp","gallery":["images/products/owner-iphone-17-white-8fe0d39e87e39555-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"31c0a6ff-41a1-83db-9545-7954c3d1a8c8","key":"iphone-17e/Black/256GB","main":"images/products/owner-iphone-17e-black-160e7e160aef5fa8-960.webp","gallery":["images/products/owner-iphone-17e-black-24effd70563bfa30-960.webp","images/products/owner-iphone-17e-black-c26fa3c92a934735-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"669f7bdd-2d16-8551-b5ad-a1e936676716","key":"iphone-17e/Black/512GB","main":"images/products/owner-iphone-17e-black-160e7e160aef5fa8-960.webp","gallery":["images/products/owner-iphone-17e-black-24effd70563bfa30-960.webp","images/products/owner-iphone-17e-black-c26fa3c92a934735-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"d6e0d029-94ae-8acd-880f-fe7765bf3764","key":"iphone-17e/Soft Pink/256GB","main":"images/products/owner-iphone-17e-soft-pink-3f8613fc64368d93-960.webp","gallery":["images/products/owner-iphone-17e-soft-pink-f1db42d3c828e1f8-960.webp","images/products/owner-iphone-17e-soft-pink-6fbe73c59cbb3802-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"d1c10b1a-68c4-8d16-aabf-177e0c6b7f67","key":"iphone-17e/Soft Pink/512GB","main":"images/products/owner-iphone-17e-soft-pink-3f8613fc64368d93-960.webp","gallery":["images/products/owner-iphone-17e-soft-pink-f1db42d3c828e1f8-960.webp","images/products/owner-iphone-17e-soft-pink-6fbe73c59cbb3802-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"432ec300-997b-86ca-9dc4-6b3546dfe7f2","key":"iphone-17e/White/256GB","main":"images/products/owner-iphone-17e-white-1d2e79614fb0642b-960.webp","gallery":["images/products/owner-iphone-17e-white-97ac572923ec0883-960.webp","images/products/owner-iphone-17e-white-c89f5b3319f2f67e-960.webp"]},
{"product_id":"c29f9c1b-49f7-8c1f-936e-ed1029c6552d","id":"af1f45a2-3f30-8900-8804-d9ba50231ccd","key":"iphone-17e/White/512GB","main":"images/products/owner-iphone-17e-white-1d2e79614fb0642b-960.webp","gallery":["images/products/owner-iphone-17e-white-97ac572923ec0883-960.webp","images/products/owner-iphone-17e-white-c89f5b3319f2f67e-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"c6b9922d-7daf-87de-af70-6e47bd199ced","key":"iphone-18-pro/Black/1TB","main":"images/products/owner-iphone-18-pro-black-1b3e082e470ad6c8-960.webp","gallery":["images/products/owner-iphone-18-pro-black-1e36d99704a8c51e-960.webp","images/products/owner-iphone-18-pro-black-fa36ee7db8f04133-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"fe61590c-a117-8958-b43a-5a977839fff1","key":"iphone-18-pro/Black/256GB","main":"images/products/owner-iphone-18-pro-black-1b3e082e470ad6c8-960.webp","gallery":["images/products/owner-iphone-18-pro-black-1e36d99704a8c51e-960.webp","images/products/owner-iphone-18-pro-black-fa36ee7db8f04133-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"a7d5ca58-54d4-8359-9322-c61d6c721182","key":"iphone-18-pro/Black/2TB","main":"images/products/owner-iphone-18-pro-black-1b3e082e470ad6c8-960.webp","gallery":["images/products/owner-iphone-18-pro-black-1e36d99704a8c51e-960.webp","images/products/owner-iphone-18-pro-black-fa36ee7db8f04133-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"71d62554-8193-8499-a500-85095e3af238","key":"iphone-18-pro/Black/512GB","main":"images/products/owner-iphone-18-pro-black-1b3e082e470ad6c8-960.webp","gallery":["images/products/owner-iphone-18-pro-black-1e36d99704a8c51e-960.webp","images/products/owner-iphone-18-pro-black-fa36ee7db8f04133-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"7b790d44-24fa-890d-89ee-c465c0e871c2","key":"iphone-18-pro/Burgundy/1TB","main":"images/products/owner-iphone-18-pro-burgundy-c6ad3b02aeb1c96d-960.webp","gallery":["images/products/owner-iphone-18-pro-burgundy-c3d20b5ff012339f-960.webp","images/products/owner-iphone-18-pro-burgundy-ac49eb6dc2160658-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"236baade-8bb0-8920-a5f2-b5c5623caa79","key":"iphone-18-pro/Burgundy/256GB","main":"images/products/owner-iphone-18-pro-burgundy-c6ad3b02aeb1c96d-960.webp","gallery":["images/products/owner-iphone-18-pro-burgundy-c3d20b5ff012339f-960.webp","images/products/owner-iphone-18-pro-burgundy-ac49eb6dc2160658-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"ffd5098f-3d5e-8ba2-9d60-61aa57f54a68","key":"iphone-18-pro/Burgundy/2TB","main":"images/products/owner-iphone-18-pro-burgundy-c6ad3b02aeb1c96d-960.webp","gallery":["images/products/owner-iphone-18-pro-burgundy-c3d20b5ff012339f-960.webp","images/products/owner-iphone-18-pro-burgundy-ac49eb6dc2160658-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"74136f9c-dcc0-81a2-a5b2-047ae4ec5317","key":"iphone-18-pro/Burgundy/512GB","main":"images/products/owner-iphone-18-pro-burgundy-c6ad3b02aeb1c96d-960.webp","gallery":["images/products/owner-iphone-18-pro-burgundy-c3d20b5ff012339f-960.webp","images/products/owner-iphone-18-pro-burgundy-ac49eb6dc2160658-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"db1934a8-d417-8852-8232-463061db9cd0","key":"iphone-18-pro/Glacier/1TB","main":"images/products/owner-iphone-18-pro-glacier-2ad0e798c4e29740-960.webp","gallery":["images/products/owner-iphone-18-pro-glacier-efed471fab58a105-960.webp","images/products/owner-iphone-18-pro-glacier-577a83f92f90302b-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"9c4f1245-3dd8-8876-916a-91f77e67611d","key":"iphone-18-pro/Glacier/256GB","main":"images/products/owner-iphone-18-pro-glacier-2ad0e798c4e29740-960.webp","gallery":["images/products/owner-iphone-18-pro-glacier-efed471fab58a105-960.webp","images/products/owner-iphone-18-pro-glacier-577a83f92f90302b-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"dc92c6c3-60da-8cbf-a337-0fe09b66344c","key":"iphone-18-pro/Glacier/2TB","main":"images/products/owner-iphone-18-pro-glacier-2ad0e798c4e29740-960.webp","gallery":["images/products/owner-iphone-18-pro-glacier-efed471fab58a105-960.webp","images/products/owner-iphone-18-pro-glacier-577a83f92f90302b-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"d13640a9-3e69-884b-967d-79b51da77c87","key":"iphone-18-pro/Glacier/512GB","main":"images/products/owner-iphone-18-pro-glacier-2ad0e798c4e29740-960.webp","gallery":["images/products/owner-iphone-18-pro-glacier-efed471fab58a105-960.webp","images/products/owner-iphone-18-pro-glacier-577a83f92f90302b-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"242fcd43-f0d1-87b1-be62-3ff9bf95a1bc","key":"iphone-18-pro/Silver/1TB","main":"images/products/owner-iphone-18-pro-silver-53a1b86e618c39ac-960.webp","gallery":["images/products/owner-iphone-18-pro-silver-2ce5eaeec9c61b84-960.webp","images/products/owner-iphone-18-pro-silver-26a4b7121516a9c8-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"370ff874-1416-8053-b5cf-c2ffcc013379","key":"iphone-18-pro/Silver/256GB","main":"images/products/owner-iphone-18-pro-silver-53a1b86e618c39ac-960.webp","gallery":["images/products/owner-iphone-18-pro-silver-2ce5eaeec9c61b84-960.webp","images/products/owner-iphone-18-pro-silver-26a4b7121516a9c8-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"f15af09a-8c97-805a-baf9-f845b73992eb","key":"iphone-18-pro/Silver/2TB","main":"images/products/owner-iphone-18-pro-silver-53a1b86e618c39ac-960.webp","gallery":["images/products/owner-iphone-18-pro-silver-2ce5eaeec9c61b84-960.webp","images/products/owner-iphone-18-pro-silver-26a4b7121516a9c8-960.webp"]},
{"product_id":"a817afd6-b1ca-8c7f-8d68-8a1bf35349fd","id":"bec75afc-0f6f-8284-9973-44036116837d","key":"iphone-18-pro/Silver/512GB","main":"images/products/owner-iphone-18-pro-silver-53a1b86e618c39ac-960.webp","gallery":["images/products/owner-iphone-18-pro-silver-2ce5eaeec9c61b84-960.webp","images/products/owner-iphone-18-pro-silver-26a4b7121516a9c8-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"d4a24af1-5e06-82cb-a251-06089cf2128e","key":"iphone-air/Cloud White/1TB","main":"images/products/owner-iphone-air-cloud-white-2ef737581bbe35d0-960.webp","gallery":["images/products/owner-iphone-air-cloud-white-e91fa9307c0a1b82-960.webp","images/products/owner-iphone-air-cloud-white-c416941c59131993-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"9a67a7f7-62aa-870b-ae87-2fdfc90df2a0","key":"iphone-air/Cloud White/256GB","main":"images/products/owner-iphone-air-cloud-white-2ef737581bbe35d0-960.webp","gallery":["images/products/owner-iphone-air-cloud-white-e91fa9307c0a1b82-960.webp","images/products/owner-iphone-air-cloud-white-c416941c59131993-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"95cc14f6-728f-8ddd-bfae-9f2ffc57b1c8","key":"iphone-air/Cloud White/512GB","main":"images/products/owner-iphone-air-cloud-white-2ef737581bbe35d0-960.webp","gallery":["images/products/owner-iphone-air-cloud-white-e91fa9307c0a1b82-960.webp","images/products/owner-iphone-air-cloud-white-c416941c59131993-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"a62201db-7c04-8198-99be-08a2dacfb649","key":"iphone-air/Light Gold/1TB","main":"images/products/owner-iphone-air-light-gold-e673f9cdc10f5163-960.webp","gallery":["images/products/owner-iphone-air-light-gold-7a0f0eeaa132dd93-960.webp","images/products/owner-iphone-air-light-gold-e4154d7ede95b4b1-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"27340322-7563-8cb3-b011-ac3802c89264","key":"iphone-air/Light Gold/256GB","main":"images/products/owner-iphone-air-light-gold-e673f9cdc10f5163-960.webp","gallery":["images/products/owner-iphone-air-light-gold-7a0f0eeaa132dd93-960.webp","images/products/owner-iphone-air-light-gold-e4154d7ede95b4b1-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"395cb817-d538-8369-b634-cc94755ed175","key":"iphone-air/Light Gold/512GB","main":"images/products/owner-iphone-air-light-gold-e673f9cdc10f5163-960.webp","gallery":["images/products/owner-iphone-air-light-gold-7a0f0eeaa132dd93-960.webp","images/products/owner-iphone-air-light-gold-e4154d7ede95b4b1-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"b25b511f-8b43-8fac-8444-62045f77b195","key":"iphone-air/Sky Blue/1TB","main":"images/products/owner-iphone-air-sky-blue-ee7f0229c636c620-960.webp","gallery":["images/products/owner-iphone-air-3a23bc983a193044.webp","images/products/owner-iphone-air-sky-blue-25a25a23edce1848-960.webp","images/products/owner-iphone-air-sky-blue-8af41af151490d95-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"59ad1588-74c7-8d27-88e8-fcf0a896d8d8","key":"iphone-air/Sky Blue/256GB","main":"images/products/owner-iphone-air-sky-blue-ee7f0229c636c620-960.webp","gallery":["images/products/owner-iphone-air-3a23bc983a193044.webp","images/products/owner-iphone-air-sky-blue-25a25a23edce1848-960.webp","images/products/owner-iphone-air-sky-blue-8af41af151490d95-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"704d99a2-ff7c-8c28-ba36-ca73bed3ab1a","key":"iphone-air/Sky Blue/512GB","main":"images/products/owner-iphone-air-sky-blue-ee7f0229c636c620-960.webp","gallery":["images/products/owner-iphone-air-3a23bc983a193044.webp","images/products/owner-iphone-air-sky-blue-25a25a23edce1848-960.webp","images/products/owner-iphone-air-sky-blue-8af41af151490d95-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"d5f08648-2915-8f19-b628-341593c63494","key":"iphone-air/Space Black/1TB","main":"images/products/owner-iphone-air-space-black-d230641574756171-960.webp","gallery":["images/products/owner-iphone-air-space-black-880a73abf641d5f9-960.webp","images/products/owner-iphone-air-space-black-a384c8dafa8ff6ce-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"813ea48b-11e4-8dbf-98e9-24cea99af6a2","key":"iphone-air/Space Black/256GB","main":"images/products/owner-iphone-air-space-black-d230641574756171-960.webp","gallery":["images/products/owner-iphone-air-space-black-880a73abf641d5f9-960.webp","images/products/owner-iphone-air-space-black-a384c8dafa8ff6ce-960.webp"]},
{"product_id":"4effd918-f1f2-8111-aa01-328002a9c53c","id":"159bb368-f8b6-8ee6-880c-158ec758b8be","key":"iphone-air/Space Black/512GB","main":"images/products/owner-iphone-air-space-black-d230641574756171-960.webp","gallery":["images/products/owner-iphone-air-space-black-880a73abf641d5f9-960.webp","images/products/owner-iphone-air-space-black-a384c8dafa8ff6ce-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"7da616f5-acc9-83fe-859d-f1a712a36d0f","key":"iphone-duo/Night Sky/1TB","main":"images/products/owner-iphone-duo-night-sky-fe0841878185a289-960.webp","gallery":["images/products/owner-iphone-duo-night-sky-470ddf338d2f3b57-960.webp","images/products/owner-iphone-duo-night-sky-33851ad146454cc6-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"a7ee783a-e783-87f2-a0a2-bce046a0e971","key":"iphone-duo/Night Sky/256GB","main":"images/products/owner-iphone-duo-night-sky-fe0841878185a289-960.webp","gallery":["images/products/owner-iphone-duo-night-sky-470ddf338d2f3b57-960.webp","images/products/owner-iphone-duo-night-sky-33851ad146454cc6-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"05ac0aae-ea58-821a-b74e-d9413d10e811","key":"iphone-duo/Night Sky/2TB","main":"images/products/owner-iphone-duo-night-sky-fe0841878185a289-960.webp","gallery":["images/products/owner-iphone-duo-night-sky-470ddf338d2f3b57-960.webp","images/products/owner-iphone-duo-night-sky-33851ad146454cc6-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"a3b2e963-f5eb-885d-b31f-e1498219bc42","key":"iphone-duo/Night Sky/512GB","main":"images/products/owner-iphone-duo-night-sky-fe0841878185a289-960.webp","gallery":["images/products/owner-iphone-duo-night-sky-470ddf338d2f3b57-960.webp","images/products/owner-iphone-duo-night-sky-33851ad146454cc6-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"15b126ea-9737-8bc9-8e13-5f032808c330","key":"iphone-duo/Star White/1TB","main":"images/products/owner-iphone-duo-star-white-f08661b08e86f6cc-960.webp","gallery":["images/products/owner-iphone-duo-star-white-a1154197a87aaade-960.webp","images/products/owner-iphone-duo-star-white-df3aa5dc37532c3e-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"488b79d5-21b1-8e3c-a49b-be4a52d9b59f","key":"iphone-duo/Star White/256GB","main":"images/products/owner-iphone-duo-star-white-f08661b08e86f6cc-960.webp","gallery":["images/products/owner-iphone-duo-star-white-a1154197a87aaade-960.webp","images/products/owner-iphone-duo-star-white-df3aa5dc37532c3e-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"8c28d134-ed93-8d82-a6f4-b1c134b09d18","key":"iphone-duo/Star White/2TB","main":"images/products/owner-iphone-duo-star-white-f08661b08e86f6cc-960.webp","gallery":["images/products/owner-iphone-duo-star-white-a1154197a87aaade-960.webp","images/products/owner-iphone-duo-star-white-df3aa5dc37532c3e-960.webp"]},
{"product_id":"e1323692-56c7-848f-b503-068d75548438","id":"406b4719-3063-86ec-aad1-fd02df74e907","key":"iphone-duo/Star White/512GB","main":"images/products/owner-iphone-duo-star-white-f08661b08e86f6cc-960.webp","gallery":["images/products/owner-iphone-duo-star-white-a1154197a87aaade-960.webp","images/products/owner-iphone-duo-star-white-df3aa5dc37532c3e-960.webp"]},
{"product_id":"b1179742-392f-8108-9095-af6dbf81adfe","id":"9210f089-ca2d-8d96-982c-e1dc7d866ed3","key":"acer-nitro-85-n85-100-ur35/Colour to confirm/N85-100-UR35 / UD.P02AA.07G","main":"images/products/owner-acer-nitro-85-n85-100-ur35-a9623226d495bfa7.webp","gallery":["images/products/owner-acer-nitro-85-n85-100-ur35-318c46fd194d482d.webp","images/products/owner-acer-nitro-85-n85-100-ur35-29bb23b9d08616fb.webp"]},
{"product_id":"e49b932d-cae1-8453-acba-81dfe0f9f666","id":"4293ae28-b8d1-8060-bb4a-c07039994efa","key":"cyberpowerpc-et99707/Colour to confirm/ET99707","main":"images/products/owner-cyberpowerpc-et99707-d29e5ba91f5bd7cf.webp","gallery":["images/products/owner-cyberpowerpc-et99707-b834ed5f3387b961.webp","images/products/owner-cyberpowerpc-et99707-2d3017f4094fd790.webp","images/products/owner-cyberpowerpc-et99707-bd999f4023684d58.webp"]},
{"product_id":"6d97ff1e-ce4b-8e54-aa20-08c257cb0928","id":"832bb31d-c15a-879f-a9c0-296c479088e0","key":"lenovo-legion-tower-5-gen-10-rtx-5070-ti/Black/90YJ001LUS","main":"images/products/owner-lenovo-legion-tower-5-gen-10-rtx-5070-ti-black-ac15c3d80719c0ad-960.webp","gallery":["images/products/owner-lenovo-legion-tower-5-gen-10-rtx-5070-ti-black-5d99a8ac547fb0a0-960.webp","images/products/owner-lenovo-legion-tower-5-gen-10-rtx-5070-ti-black-53f248a2659287c4-960.webp","images/products/owner-lenovo-legion-tower-5-gen-10-rtx-5070-ti-black-b2ffd81dab7c8502-960.webp","images/products/owner-lenovo-legion-tower-5-gen-10-rtx-5070-ti-black-4278a120a7abdf0b-960.webp"]},
{"product_id":"997fac76-b60c-82e7-84a1-00cd7164cff2","id":"c61021a4-ce8e-8ac4-a0d1-227b89e98650","key":"ps5-pro-2tb/Colour to confirm/Standard configuration","main":"images/products/owner-ps5-pro-2tb-aff69e8567bbe071.webp","gallery":[]}]
$store_zip$::jsonb) as m(product_id uuid,id uuid,key text,main text,gallery text[]);

-- Price is the owner's $550 less 10%, stored as the final sale price.
-- Inventory stays absent until the actual quantities by finish are supplied.
create temporary table zip_max_finishes(color text,sku text,image text) on commit drop;
insert into zip_max_finishes values
('Blue', 'STORE-AIRPODS-MAX-2-BLUE', 'images/products/owner-airpods-max-2-blue-639b8dfb5e93510f.webp'),
('Midnight', 'STORE-AIRPODS-MAX-2-MIDNIGHT', 'images/products/owner-airpods-max-2-midnight-be933786b631c81d.webp'),
('Purple', 'STORE-AIRPODS-MAX-2-PURPLE', 'images/products/owner-airpods-max-2-purple-ece772a9f0278b07.webp'),
('Starlight', 'STORE-AIRPODS-MAX-2-STARLIGHT', 'images/products/owner-airpods-max-2-starlight-c2113fa031e07942.webp');
insert into public.product_variants (
  product_id,sku,color,configuration,price_cents,price_source,price_verified_at,
  catalogue_key,catalogue_visible,active,gallery_paths
)
select p.id,f.sku,f.color,'USB-C',49500,'Owner-approved $550 less 10%',now(),
  'airpods-max-2/'||f.color||'/USB-C',true,false,'{}'::text[]
from zip_max_finishes f cross join public.products p
where p.catalogue_key='airpods-max-2' and p.brand='Apple'
on conflict (catalogue_key) where catalogue_key is not null do nothing;

insert into reviewed_zip_media(product_id,id,key,main,gallery)
select p.id,v.id,v.catalogue_key,f.image,'{}'::text[]
from zip_max_finishes f
join public.product_variants v on v.catalogue_key='airpods-max-2/'||f.color||'/USB-C'
join public.products p on p.id=v.product_id and p.catalogue_key='airpods-max-2';

do $store_zip_check$
begin
  if (select count(*) from reviewed_zip_media where key like 'airpods-max-2/%') <> 4 or exists (
    select 1 from reviewed_zip_media m
    left join public.product_variants v on v.id=m.id and v.product_id=m.product_id and v.catalogue_key=m.key
    left join public.products p on p.id=v.product_id
    where p.id is null or p.catalogue_key is distinct from split_part(m.key,'/',1)
      or not v.catalogue_visible or m.main is null
  ) or exists (
    select 1 from public.product_variants v
    where v.product_id in (select product_id from reviewed_zip_media)
      and (v.active or v.catalogue_visible)
      and not exists (select 1 from reviewed_zip_media m where m.id=v.id)
  ) then
    raise exception 'Hosted product or variant does not match the reviewed ZIP plan';
  end if;
end
$store_zip_check$;

update public.product_variants v
set image_path=m.main, gallery_paths=m.gallery, image_source='Owner-supplied Dataset of Store.zip',
    image_permission='approved', image_verified_at=now()
from reviewed_zip_media m
where v.id=m.id and (v.image_path,v.gallery_paths,v.image_permission,v.image_source,v.image_verified_at is not null)
  is distinct from (m.main,m.gallery,'approved'::text,'Owner-supplied Dataset of Store.zip'::text,true);

-- Preserve historical product, variant, review and order records.
update public.products p set published=false
where p.published and not exists (select 1 from reviewed_zip_media m where m.product_id=p.id)
returning p.catalogue_key as unpublished_key;

update public.product_variants v
set price_cents=49500,price_source='Owner-approved $550 less 10%',price_verified_at=now()
from reviewed_zip_media m
where m.id=v.id and m.key like 'airpods-max-2/%' and v.price_cents<>49500;

update public.products p
set published=true,price_label='Store selling price',
    catalogue_note='Owner-approved $495 sale price. Stock by finish needs confirmation.'
where p.catalogue_key='airpods-max-2' and not p.published
  and exists (select 1 from reviewed_zip_media m where m.product_id=p.id)
returning p.catalogue_key as added_key;

-- The owner approved restoring the existing PS5 Pro listing. Its prior price and
-- inventory remain provisional, so the listing is browse-only.
update public.products p
set published=true
where p.catalogue_key='ps5-pro-2tb' and not p.published
  and exists (select 1 from reviewed_zip_media m where m.product_id=p.id)
returning p.catalogue_key as restored_key;

do $store_zip_verify$
begin
  if (select count(*) from public.storefront_catalogue()) <>
     (select count(distinct product_id) from reviewed_zip_media)
    or exists (
      select 1 from public.storefront_catalogue() p
      cross join lateral jsonb_array_elements(p->'variants') v
      where not exists (
        select 1 from reviewed_zip_media m
        where m.product_id=(p->>'id')::uuid and m.id=(v->>'id')::uuid
          and m.main=v->>'image_path' and to_jsonb(m.gallery)=v->'gallery_paths'
      )
    ) then raise exception 'Public catalogue does not match the reviewed ZIP'; end if;
end
$store_zip_verify$;
commit;

select jsonb_agg(p->>'name' order by p->>'name') as zip_storefront
from public.storefront_catalogue() p;
