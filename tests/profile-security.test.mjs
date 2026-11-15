import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {storageFixture} from './storage-fixture.mjs';
import {googlePicture,avatarPath,profileOverview,validateAvatar} from '../js/profile.js';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',file='33333333-3333-4333-8333-333333333333.webp';
test('profile view keeps editing opt-in and validates avatar URLs and files',()=>{
 assert.equal(googlePicture('https://lh3.googleusercontent.com/photo'),'https://lh3.googleusercontent.com/photo');
 for(const url of ['javascript:alert(1)','https://lh3.googleusercontent.com.evil.invalid/p','https://evil.invalid/p','https://user@lh3.googleusercontent.com/p'])assert.equal(googlePicture(url),null);
 assert.equal(avatarPath(bob+'/'+file,alice),null);assert.equal(avatarPath(alice+'/'+file,alice),alice+'/'+file);
 assert.throws(()=>validateAvatar({type:'image/svg+xml',size:100}));assert.throws(()=>validateAvatar({type:'image/png',size:2097153}));
 const html=profileOverview({display_name:'<buyer>'},{email:'buyer@example.invalid'},null);assert.match(html,/&lt;buyer&gt;/);assert.match(html,/<summary>Edit Profile<\/summary>/);assert.doesNotMatch(html,/<details[^>]*\sopen/);
});
test('Google sync preserves manual edits; private avatars and profile contacts isolate two customers',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt',true),''),'{}')::jsonb$$;grant usage on schema public,auth to authenticated;grant execute on all functions in schema auth to authenticated;create table profiles(id uuid primary key references auth.users,display_name text);alter table profiles enable row level security;create policy own_profile on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());grant select,insert,update on profiles to authenticated;`);
 await storageFixture(db);const sql=await readFile('supabase/migrations/030_customer_profiles.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.query('insert into auth.users values($1),($2)',[alice,bob]);await db.query("select set_config('request.uid',$1,false)",[alice]);await db.query("select set_config('request.jwt',$1,false)",[JSON.stringify({app_metadata:{provider:'google'},user_metadata:{full_name:'Alice',phone:'+923001234567',avatar_url:'https://lh3.googleusercontent.com/a'}})]);await db.exec('set role authenticated');
 await db.query('select sync_my_profile()');assert.equal((await db.query('select display_name,phone from profiles')).rows[0].phone,'+923001234567');
 await db.query("update profiles set display_name='Manual name',avatar_mode='none'");await db.query('select sync_my_profile()');assert.equal((await db.query('select display_name,avatar_mode from profiles')).rows[0].display_name,'Manual name');assert.equal((await db.query('select avatar_mode from profiles')).rows[0].avatar_mode,'none');
 await assert.rejects(()=>db.query('update profiles set avatar_path=$1',[bob+'/'+file]),/profile_avatar_scope/);
 await assert.rejects(()=>db.query("update profiles set phone='123'"),/profile_contact_format/);
 await db.query("insert into storage.objects(bucket_id,name) values('profile-avatars',$1)",[alice+'/'+file]);
 await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('profile-avatars',$1)",[bob+'/'+file]),/row-level security/);
 await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[bob]);await db.exec('set role authenticated');assert.equal((await db.query('select * from profiles')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
 }finally{await db.close();}
});
