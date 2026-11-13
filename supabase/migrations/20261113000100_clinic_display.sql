-- One singleton lock serializes all public-state mutations.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.display_state (
 id smallint primary key check (id=1),
 current_number integer not null default 0 check (current_number between 0 and 9999),
 active_ads jsonb not null default '[]'::jsonb check(jsonb_typeof(active_ads)='array'),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
insert into public.display_state(id) values(1);
create table public.advertisements (
 id uuid primary key default gen_random_uuid(),
 title varchar(100) not null check(length(btrim(title))>0),
 type text not null check(type in ('image','text')),
 image_url text,
 storage_path text,
 heading varchar(120),
 message varchar(500),
 duration_seconds integer not null default 10 check(duration_seconds between 3 and 120),
 is_active boolean not null default true,
 display_order integer not null check(display_order>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint valid_ad_content check (
  (type='image' and image_url is not null and storage_path is not null and storage_path ~ '^ads/[0-9a-f-]{36}\.(jpg|png|webp)$' and heading is null and message is null)
  or (type='text' and heading is not null and message is not null and length(btrim(heading))>0 and length(btrim(message))>0 and image_url is null and storage_path is null)
 )
);
create index advertisements_order_idx on public.advertisements(display_order,id);
create index advertisements_active_idx on public.advertisements(is_active,display_order);
create index advertisements_storage_idx on public.advertisements(storage_path);
-- Trusted deployment configuration, never writable/readable by browser roles.
create table private.settings(id boolean primary key default true check(id),storage_base_url text not null check(storage_base_url ~ '^https?://[^/]+/storage/v1/object/public/advertisements$'));
alter table private.settings enable row level security;
revoke all on private.settings from public, anon, authenticated;
insert into private.settings(id,storage_base_url) values(true,'http://127.0.0.1:54321/storage/v1/object/public/advertisements');

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()));
$$;
create function private.require_admin_lock() returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform id from public.display_state where id=1 for update;
end;
$$;
create function private.rebuild_snapshot() returns public.display_state language plpgsql security definer set search_path='' as $$
declare result public.display_state;
begin
 update public.display_state set active_ads=coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'type',a.type,'image_url',a.image_url,'heading',a.heading,'message',a.message,'duration_seconds',a.duration_seconds,'display_order',a.display_order) order by a.display_order,a.id) from public.advertisements a where a.is_active),'[]'::jsonb),revision=revision+1,updated_at=clock_timestamp() where id=1 returning * into result;
 return result;
end;
$$;
create function private.change_number(p_delta integer,p_value integer) returns public.display_state language plpgsql security definer set search_path='' as $$
declare result public.display_state; next_number integer;
begin
 perform private.require_admin_lock();
 select case when p_delta is null then p_value else current_number+p_delta end into next_number from public.display_state where id=1;
 if next_number is null or next_number not between 0 and 9999 then raise exception 'Number must be between 0 and 9999' using errcode='22023'; end if;
 update public.display_state set current_number=next_number,revision=revision+1,updated_at=clock_timestamp() where id=1 returning * into result;
 return result;
end;
$$;
create function public.increment_appointment() returns public.display_state language sql security definer set search_path='' as $$ select private.change_number(1,null); $$;
create function public.decrement_appointment() returns public.display_state language sql security definer set search_path='' as $$ select private.change_number(-1,null); $$;
create function public.set_appointment_number(p_number integer) returns public.display_state language sql security definer set search_path='' as $$ select private.change_number(null,p_number); $$;
create function public.reset_appointment_number() returns public.display_state language sql security definer set search_path='' as $$ select private.change_number(null,0); $$;

-- A trigger also validates trusted SQL writes: no external image URLs or missing objects.
create function private.validate_ad_image() returns trigger language plpgsql security definer set search_path='' as $$
declare base text;
begin
 if new.type='image' then
  perform id from storage.objects where bucket_id='advertisements' and name=new.storage_path for share;
  if not found then raise exception 'Image object does not exist' using errcode='22023'; end if;
  select storage_base_url into base from private.settings where id=true;
  new.image_url=base||'/'||new.storage_path;
  new.heading=null;new.message=null;
 else new.image_url=null;new.storage_path=null;
 end if;
 new.updated_at=clock_timestamp();
 return new;
end;
$$;
create trigger validate_ad_image before insert or update on public.advertisements for each row execute function private.validate_ad_image();

create function public.create_advertisement(p_title text,p_type text,p_heading text,p_message text,p_storage_path text,p_duration_seconds integer,p_is_active boolean) returns public.advertisements language plpgsql security definer set search_path='' as $$
declare result public.advertisements; next_order integer;
begin
 perform private.require_admin_lock();
 select coalesce(max(display_order)+1,0) into next_order from public.advertisements;
 insert into public.advertisements(title,type,heading,message,storage_path,duration_seconds,is_active,display_order) values(btrim(p_title),p_type,btrim(p_heading),btrim(p_message),p_storage_path,p_duration_seconds,p_is_active,next_order) returning * into result;
 perform private.rebuild_snapshot(); return result;
end;
$$;
create function public.update_advertisement(p_id uuid,p_title text,p_type text,p_heading text,p_message text,p_storage_path text,p_duration_seconds integer,p_is_active boolean) returns public.advertisements language plpgsql security definer set search_path='' as $$
declare result public.advertisements;
begin
 perform private.require_admin_lock();
 update public.advertisements set title=btrim(p_title),type=p_type,heading=btrim(p_heading),message=btrim(p_message),storage_path=p_storage_path,duration_seconds=p_duration_seconds,is_active=p_is_active where id=p_id returning * into result;
 if not found then raise exception 'Advertisement not found' using errcode='22023';end if;
 perform private.rebuild_snapshot(); return result;
end;
$$;
create function public.delete_advertisement(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin_lock();
 delete from public.advertisements where id=p_id;
 if not found then raise exception 'Advertisement not found' using errcode='22023';end if;
 perform private.rebuild_snapshot();
end;
$$;
create function public.set_advertisement_active(p_id uuid,p_is_active boolean) returns public.advertisements language plpgsql security definer set search_path='' as $$
declare result public.advertisements;
begin
 perform private.require_admin_lock();
 update public.advertisements set is_active=p_is_active where id=p_id returning * into result;
 if not found then raise exception 'Advertisement not found' using errcode='22023';end if;
 perform private.rebuild_snapshot(); return result;
end;
$$;
create function public.move_advertisement(p_id uuid,p_direction integer) returns void language plpgsql security definer set search_path='' as $$
declare ids uuid[]; pos integer; other uuid;
begin
 perform private.require_admin_lock();
 if p_direction is null or p_direction not in (-1,1) then raise exception 'Direction must be -1 or 1' using errcode='22023';end if;
 select array_agg(id order by display_order,id) into ids from public.advertisements;
 pos=array_position(ids,p_id);
 if pos is null then raise exception 'Advertisement not found' using errcode='22023';end if;
 if pos+p_direction<1 or pos+p_direction>array_length(ids,1) then raise exception 'Already at boundary' using errcode='22023';end if;
 other=ids[pos+p_direction]; ids[pos+p_direction]=p_id; ids[pos]=other;
 update public.advertisements a set display_order=s.ordinality-1 from unnest(ids) with ordinality s(id,ordinality) where a.id=s.id;
 perform private.rebuild_snapshot();
end;
$$;

alter table public.admin_users enable row level security;
alter table public.display_state enable row level security;
alter table public.advertisements enable row level security;
revoke all on public.admin_users,public.display_state,public.advertisements from anon,authenticated;
grant select on public.display_state to anon,authenticated;
grant select on public.advertisements to authenticated;
create policy "Read public singleton" on public.display_state for select to anon,authenticated using(id=1);
create policy "Admins read advertisements" on public.advertisements for select to authenticated using((select public.is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('advertisements','advertisements',true,5242880,array['image/jpeg','image/png','image/webp']);
create function public.can_delete_ad_image(p_path text) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 if not public.is_admin() then return false;end if;
 perform id from public.display_state where id=1 for update;
 return not exists(select 1 from public.advertisements where storage_path=p_path);
end;
$$;
create policy "Admins upload unique ad images" on storage.objects for insert to authenticated with check(bucket_id='advertisements' and (select public.is_admin()) and name ~ '^ads/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy "Admins inspect ad objects" on storage.objects for select to authenticated using(bucket_id='advertisements' and (select public.is_admin()));
create policy "Admins delete unreferenced ad images" on storage.objects for delete to authenticated using(bucket_id='advertisements' and public.can_delete_ad_image(name));
-- No UPDATE policy: every replacement has a new path.

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_admin(),public.increment_appointment(),public.decrement_appointment(),public.set_appointment_number(integer),public.reset_appointment_number(),public.create_advertisement(text,text,text,text,text,integer,boolean),public.update_advertisement(uuid,text,text,text,text,text,integer,boolean),public.delete_advertisement(uuid),public.set_advertisement_active(uuid,boolean),public.move_advertisement(uuid,integer),public.can_delete_ad_image(text) from public,anon,authenticated;
grant execute on function public.is_admin(),public.increment_appointment(),public.decrement_appointment(),public.set_appointment_number(integer),public.reset_appointment_number(),public.create_advertisement(text,text,text,text,text,integer,boolean),public.update_advertisement(uuid,text,text,text,text,text,integer,boolean),public.delete_advertisement(uuid),public.set_advertisement_active(uuid,boolean),public.move_advertisement(uuid,integer),public.can_delete_ad_image(text) to authenticated;
alter publication supabase_realtime add table public.display_state;
