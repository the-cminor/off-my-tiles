/* Off My Tiles! — Supabase adapter.
   The game was written for Claude artifact storage (window.claude.use("db"/"user")).
   This file provides the same calls, backed by Supabase, so the game code stays unchanged.
   Players sign in anonymously (no email needed); their save stays tied to this browser. */
(function () {
  const SUPABASE_URL = "https://mlkxbquszktxydgtkpot.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PUo7EpD1r_S_a45G6aAjiA_O65OoNMb"; // public key, safe in front-end code

  let sb = null, sessionP = null;
  const client = () => sb || (sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "omt_auth" }
  }));

  function session() {
    if (!sessionP) sessionP = (async () => {
      const c = client();
      let { data: { session } } = await c.auth.getSession();
      if (!session) {
        const r = await c.auth.signInAnonymously();
        if (r.error) throw r.error;
        session = r.data.session;
      }
      return session;
    })().catch(e => { sessionP = null; throw e; });
    return sessionP;
  }

  const T = () => client().from("docs");
  const snap = row => ({ exists: !!row, id: row ? row.id : undefined, data: () => (row ? row.data : undefined) });
  const fail = e => { const err = new Error(e.message || "storage error"); err.code = e.code || "denied"; throw err; };

  function docRef(col, id) {
    return {
      id,
      async get() {
        await session().catch(() => {});
        const { data, error } = await T().select("id,data").eq("collection", col).eq("id", id).maybeSingle();
        if (error) fail(error);
        return snap(data);
      },
      async set(value) {
        await session();
        const { error } = await T().upsert({ collection: col, id, data: value }, { onConflict: "collection,id" });
        if (error) fail(error);
      },
      async update(patch) {
        await session();
        const { data: cur, error: e1 } = await T().select("data").eq("collection", col).eq("id", id).maybeSingle();
        if (e1) fail(e1);
        if (!cur) fail({ code: "not-found", message: "document not found" });
        const { data, error } = await T().update({ data: { ...cur.data, ...patch } }).eq("collection", col).eq("id", id).select("id");
        if (error) fail(error);
        if (!data || !data.length) fail({ code: "denied", message: "not allowed" });
      },
      async delete() {
        await session();
        const { error } = await T().delete().eq("collection", col).eq("id", id);
        if (error) fail(error);
      }
    };
  }

  function collectionRef(col) {
    return {
      doc: id => docRef(col, id),
      onSnapshot(cb, onErr) {
        let timer = null, alive = true;
        const load = async () => {
          const { data, error } = await T().select("id,data").eq("collection", col).limit(1000);
          if (!alive) return;
          if (error) { onErr && onErr(error); return; }
          cb({ docs: data.map(r => ({ id: r.id, data: () => r.data })) });
        };
        const soon = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
        session().catch(() => {}).then(load);
        const ch = client().channel("omt-" + col + "-" + Math.random().toString(36).slice(2))
          .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "collection=eq." + col }, soon)
          .subscribe();
        const poll = setInterval(load, 60000); // backup in case realtime drops
        const vis = () => { if (!document.hidden) soon(); };
        document.addEventListener("visibilitychange", vis);
        return () => { alive = false; clearInterval(poll); document.removeEventListener("visibilitychange", vis); client().removeChannel(ch); };
      }
    };
  }

  function splitPath(path) { const i = path.lastIndexOf("/"); return [path.slice(0, i), path.slice(i + 1)]; }

  const db = {
    collection: collectionRef,
    doc: path => { const [c, id] = splitPath(path); return docRef(c, id); }
  };

  const user = {
    async id() { try { return (await session()).user.id; } catch (e) { console.warn("Off My Tiles: sign-in failed", e); return null; } },
    async me() { return { name: "", email: "" }; },
    async isOwner() { return false; },
    async profiles() { return {}; }
  };

  window.claude = {
    async use(name) {
      if (!window.supabase) return null;
      if (name === "db") return db;
      if (name === "user") return user;
      return null; // "artifact" and anything else: not available outside Claude
    }
  };
})();
