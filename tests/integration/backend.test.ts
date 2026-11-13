import { createClient } from "@supabase/supabase-js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
const env = process.env;
const available = Boolean(
  env.TEST_SUPABASE_URL &&
  env.TEST_SUPABASE_PUBLISHABLE_KEY &&
  env.TEST_ADMIN_EMAIL &&
  env.TEST_ADMIN_PASSWORD &&
  env.TEST_NONADMIN_EMAIL &&
  env.TEST_NONADMIN_PASSWORD,
);
describe.skipIf(!available)(
  "Real Supabase backend (disposable test project only)",
  () => {
    const make = () =>
      createClient(env.TEST_SUPABASE_URL!, env.TEST_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    let admin: ReturnType<typeof make>,
      anon: ReturnType<typeof make>,
      other: ReturnType<typeof make>;
    const ids: string[] = [];
    beforeAll(async () => {
      admin = make();
      anon = make();
      other = make();
      expect(
        (
          await admin.auth.signInWithPassword({
            email: env.TEST_ADMIN_EMAIL!,
            password: env.TEST_ADMIN_PASSWORD!,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await other.auth.signInWithPassword({
            email: env.TEST_NONADMIN_EMAIL!,
            password: env.TEST_NONADMIN_PASSWORD!,
          })
        ).error,
      ).toBeNull();
    });
    afterAll(async () => {
      for (const id of ids)
        await admin.rpc("delete_advertisement", { p_id: id });
      await admin.rpc("reset_appointment_number");
      await admin.auth.signOut();
      await other.auth.signOut();
    });
    it("denies anonymous and non-admin writes, direct mutations and membership reads", async () => {
      for (const db of [anon, other]) {
        expect((await db.rpc("increment_appointment")).error).not.toBeNull();
        expect(
          (
            await db
              .from("display_state")
              .update({ current_number: 888 })
              .eq("id", 1)
          ).error,
        ).not.toBeNull();
        expect((await db.from("admin_users").select("*")).error).not.toBeNull();
      }
      expect((await anon.from("display_state").select("*")).error).toBeNull();
      expect(
        (
          await admin
            .from("display_state")
            .update({ current_number: 888 })
            .eq("id", 1)
        ).error,
      ).not.toBeNull();
    });
    it("serializes independent increments without lost updates and enforces boundaries", async () => {
      expect(
        (await admin.rpc("set_appointment_number", { p_number: 0 })).error,
      ).toBeNull();
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => admin.rpc("increment_appointment")),
      );
      expect(responses.every((r) => !r.error)).toBe(true);
      const { data } = await anon.from("display_state").select("*").single();
      expect(data.current_number).toBe(8);
      expect(
        (await admin.rpc("set_appointment_number", { p_number: 10000 })).error,
      ).not.toBeNull();
      await admin.rpc("reset_appointment_number");
      expect((await admin.rpc("decrement_appointment")).error).not.toBeNull();
    });
    it("publishes CRUD, toggles and ordering transactionally without private titles", async () => {
      const payload = {
        p_title: "Internal only",
        p_type: "text",
        p_heading: "Welcome",
        p_message: "Please wait",
        p_storage_path: null,
        p_duration_seconds: 3,
        p_is_active: true,
      };
      for (let i = 0; i < 2; i++) {
        const { data, error } = await admin.rpc(
          "create_advertisement",
          payload,
        );
        expect(error).toBeNull();
        ids.push(data.id);
      }
      expect(
        (
          await admin.rpc("move_advertisement", {
            p_id: ids[1],
            p_direction: -1,
          })
        ).error,
      ).toBeNull();
      let result = await anon.from("display_state").select("*").single();
      expect(
        result.data.active_ads.findIndex(
          (a: { id: string }) => a.id === ids[1],
        ),
      ).toBeLessThan(
        result.data.active_ads.findIndex(
          (a: { id: string }) => a.id === ids[0],
        ),
      );
      expect(JSON.stringify(result.data)).not.toContain("Internal only");
      expect(
        (
          await admin.rpc("update_advertisement", {
            ...payload,
            p_id: ids[0],
            p_heading: "Updated",
          })
        ).error,
      ).toBeNull();
      await admin.rpc("set_advertisement_active", {
        p_id: ids[0],
        p_is_active: false,
      });
      result = await anon.from("display_state").select("*").single();
      expect(
        result.data.active_ads.some((a: { id: string }) => a.id === ids[0]),
      ).toBe(false);
      expect(
        (
          await admin.rpc("create_advertisement", {
            ...payload,
            p_duration_seconds: 2,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await admin.rpc("create_advertisement", {
            ...payload,
            p_type: "image",
            p_storage_path: "ads/missing.png",
          })
        ).error,
      ).not.toBeNull();
    });
    it("denies unauthorized storage uploads", async () => {
      for (const db of [anon, other])
        expect(
          (
            await db.storage
              .from("advertisements")
              .upload(`ads/${crypto.randomUUID()}.png`, new Uint8Array([1]), {
                contentType: "image/png",
              })
          ).error,
        ).not.toBeNull();
    });
  },
);
