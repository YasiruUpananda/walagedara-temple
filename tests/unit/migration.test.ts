// @vitest-environment node
// Runs the real migration in embedded PostgreSQL with minimal Supabase schema stubs.
// This checks SQL behavior, not the hosted Auth/Storage/Realtime services.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DisplayState } from "../../src/types";
let db: PGlite;
const doctor = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now());
 alter table storage.objects enable row level security;
 create publication supabase_realtime;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113000100_clinic_display.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users(id) values('${doctor}'); insert into public.admin_users(user_id) values('${doctor}'); select set_config('request.jwt.claim.sub','${doctor}',false);`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261113000200_service_availability.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("migration in embedded PostgreSQL", () => {
  it("only admins can pause the service and the queue is preserved", async () => {
    const before = (
      await db.query<DisplayState>(
        "select current_number,active_ads,revision from public.display_state",
      )
    ).rows[0];
    await db.exec("set role anon");
    await expect(
      db.exec("select public.set_service_paused(true)"),
    ).rejects.toThrow();
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false); set role authenticated`,
    );
    await expect(
      db.exec("select public.set_service_paused(true)"),
    ).rejects.toThrow();
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${doctor}',false); set role authenticated`,
    );
    await db.exec("select public.set_service_paused(true)");
    const paused = (await db.query<DisplayState>("select * from public.display_state"))
      .rows[0];
    expect(paused.service_paused).toBe(true);
    expect(paused.current_number).toBe(before.current_number);
    expect(paused.active_ads).toEqual(before.active_ads);
    expect(Number(paused.revision)).toBe(Number(before.revision) + 1);
    await expect(
      db.exec("select public.set_service_paused(null)"),
    ).rejects.toThrow();
    await db.exec("select public.set_service_paused(false); reset role");
    expect(
      (await db.query<DisplayState>("select service_paused from public.display_state"))
        .rows[0].service_paused,
    ).toBe(false);
  });
  it("initializes only the singleton and no fake advertisements", async () => {
    const { rows } = await db.query(
      "select current_number,active_ads from public.display_state",
    );
    expect(rows).toEqual([{ current_number: 0, active_ads: [] }]);
  });
  it("executes queue mutations and boundary checks", async () => {
    await db.exec(
      "select public.increment_appointment(); select public.increment_appointment(); select public.decrement_appointment();",
    );
    expect(
      (
        await db.query<{ current_number: number }>(
          "select current_number from public.display_state",
        )
      ).rows[0].current_number,
    ).toBe(1);
    await expect(
      db.exec("select public.set_appointment_number(10000)"),
    ).rejects.toThrow();
    await db.exec("select public.reset_appointment_number()");
    await expect(
      db.exec("select public.decrement_appointment()"),
    ).rejects.toThrow();
  });
  it("denies browser direct writes and unauthorized RPC access", async () => {
    await db.exec("set role authenticated");
    await expect(
      db.exec("update public.display_state set current_number=88 where id=1"),
    ).rejects.toThrow();
    await expect(
      db.exec(`insert into public.admin_users(user_id) values('${doctor}')`),
    ).rejects.toThrow();
    await expect(
      db.exec("select private.rebuild_snapshot()"),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.exec(
      "select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);set role authenticated",
    );
    await expect(
      db.exec("select public.increment_appointment()"),
    ).rejects.toThrow();
    expect(
      (await db.query("select * from public.advertisements")).rows,
    ).toEqual([]);
    await db.exec("reset role;set role anon");
    expect(
      (await db.query("select * from public.display_state")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec("select public.increment_appointment()"),
    ).rejects.toThrow();
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${doctor}',false)`,
    );
  });
  it("creates, edits, reorders, disables and deletes snapshots transactionally", async () => {
    const create = () =>
      db.query<{ id: string }>(
        "select id from public.create_advertisement('Private title','text','Hello','Please wait',null,10,true)",
      );
    const first = (await create()).rows[0].id;
    const second = (await create()).rows[0].id;
    await db.query("select public.move_advertisement($1,-1)", [second]);
    const snapshot = async () =>
      (
        await db.query<{ active_ads: Array<{ id: string; heading: string }> }>(
          "select active_ads from public.display_state",
        )
      ).rows[0].active_ads;
    expect((await snapshot()).map((a) => a.id)).toEqual([second, first]);
    expect(JSON.stringify(await snapshot())).not.toContain("Private title");
    await db.query(
      "select public.update_advertisement($1,'Updated title','text','Changed','Hello',null,3,true)",
      [first],
    );
    expect((await snapshot()).find((a) => a.id === first)?.heading).toBe(
      "Changed",
    );
    await db.query("select public.set_advertisement_active($1,false)", [
      second,
    ]);
    expect((await snapshot()).map((a) => a.id)).toEqual([first]);
    await expect(
      db.exec(
        "select public.create_advertisement(' ','text','h','m',null,10,true)",
      ),
    ).rejects.toThrow();
    await db.query("select public.delete_advertisement($1)", [first]);
    await db.query("select public.delete_advertisement($1)", [second]);
    expect(await snapshot()).toEqual([]);
  });
  it("rejects missing image references and prevents referenced image deletion", async () => {
    const path = "ads/33333333-3333-4333-8333-333333333333.png";
    await expect(
      db.query(
        "select public.create_advertisement('Image','image',null,null,$1,10,true)",
        [path],
      ),
    ).rejects.toThrow();
    await db.query(
      "insert into storage.objects(bucket_id,name) values('advertisements',$1)",
      [path],
    );
    const { rows } = await db.query<{ id: string; image_url: string }>(
      "select id,image_url from public.create_advertisement('Image','image',null,null,$1,10,true)",
      [path],
    );
    expect(rows[0].image_url).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/advertisements/${path}`,
    );
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_delete_ad_image($1) as allowed",
          [path],
        )
      ).rows[0].allowed,
    ).toBe(false);
    await db.query("select public.delete_advertisement($1)", [rows[0].id]);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.can_delete_ad_image($1) as allowed",
          [path],
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
});
