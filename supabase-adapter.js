/* Off My Tiles! — Supabase adapter.
   The game was written for Claude artifact storage (window.claude.use("db"/"user")).
   This file provides the same calls, backed by Supabase, so the game code stays unchanged.
   Players sign in anonymously (no email needed); their save stays tied to this browser. */
(function () {
  const SUPABASE_URL = "https://mlkxbquszktxydgtkpot.supabase.co";
  const SUPABASE_KEY = "sb_publishable_PUo7EpD1r_S_a45G6aAjiA_O65OoNMb"; // public key, safe in front-end code

  let sb = null, sessionP = null;
  const client = () => sb || (sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce", storageKey: "omt_auth" }
  }));
  const backUrl = () => location.origin + location.pathname;

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

  /* ---------- Google login ----------
     A guest (anonymous) player who signs in with Google keeps their progress: the Google account is
     linked to the guest account. If that Google account already plays on another device, we switch to it
     instead; the game then keeps whichever progress is further along. */
  const google = () => client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: backUrl() } });
  async function signInGoogle() {
    const s = await session().catch(() => null);
    if (s && s.user && s.user.is_anonymous) {
      const { error } = await client().auth.linkIdentity({ provider: "google", options: { redirectTo: backUrl() } });
      if (!error) return;
    }
    await google();
  }
  // back from Google with "already linked to another player": switch to that player
  (function () {
    const q = new URLSearchParams(location.search + "&" + location.hash.slice(1));
    if (q.get("error_code") === "identity_already_exists") {
      history.replaceState(null, "", backUrl());
      if (window.supabase) google();
    }
  })();

  window.omtAccount = async function (row, tr) {
    if (!row || !window.supabase) return;
    const s = await session().catch(() => null);
    const u = s && s.user;
    const head = `<div class="setl">${tr("Account", "บัญชี")}</div>`;
    if (!u) { row.innerHTML = head + `<small class="seth">${tr("Can't reach the save server right now.", "ตอนนี้เชื่อมต่อเซิร์ฟเวอร์บันทึกไม่ได้")}</small>`; return; }
    if (u.is_anonymous) {
      row.innerHTML = head + `<small class="seth">${tr("Playing as a guest: your save stays in this browser only. Sign in to keep it on any phone or computer, or to use a transfer code from the old version.", "เล่นแบบผู้เยี่ยมชม: เซฟอยู่แค่ในเบราว์เซอร์นี้ ล็อกอินเพื่อเล่นต่อได้ทุกเครื่อง หรือเพื่อใช้โค้ดย้ายคะแนนจากเวอร์ชันเก่า")}</small>
        <button class="big" id="gIn">${tr("Sign in with Google", "ล็อกอินด้วย Google")}</button>`;
      row.querySelector("#gIn").onclick = async e => {
        e.target.disabled = true;
        try { await signInGoogle(); } catch (err) { e.target.disabled = false; alert(tr("Couldn't open Google sign-in. Try again.", "เปิดหน้าล็อกอิน Google ไม่ได้ ลองอีกครั้ง")); }
      };
    } else {
      const who = (u.email || (u.user_metadata && u.user_metadata.email) || "Google").replace(/[<>&"]/g, "");
      row.innerHTML = head + `<small class="seth">${tr("Signed in as", "ล็อกอินเป็น")} ${who}. ${tr("Your save follows you to any device.", "เซฟจะตามไปทุกเครื่อง")}</small>
        <div class="setl" style="margin-top:4px">${tr("Transfer code", "โค้ดย้ายคะแนน")}</div>
        <small class="seth">${tr("Played the old Claude version? Enter the code Cin gave you to bring your level and stars here.", "เคยเล่นเวอร์ชันเก่าใน Claude? ใส่โค้ดที่ได้รับเพื่อย้ายเลเวลและดาวมาที่นี่")}</small>
        <div class="nickrow" style="margin:0"><input id="tCode" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX" style="text-transform:uppercase;user-select:text;-webkit-user-select:text"><button id="tGo">${tr("Move", "ย้าย")}</button></div>
        <small class="seth" id="tMsg"></small>
        <button class="big alt" id="gOut">${tr("Sign out", "ออกจากระบบ")}</button>`;
      row.querySelector("#gOut").onclick = async () => { await client().auth.signOut().catch(() => {}); location.reload(); };
      const msg = t => { row.querySelector("#tMsg").textContent = t; };
      row.querySelector("#tGo").onclick = async e => {
        const code = row.querySelector("#tCode").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (code.length !== 8) { msg(tr("The code has 8 letters and numbers.", "โค้ดมี 8 ตัว (ตัวอักษรและตัวเลข)")); return; }
        e.target.disabled = true; msg(tr("Moving…", "กำลังย้าย…"));
        const { data, error } = await client().rpc("claim_legacy", { p_code: code });
        if (error) {
          e.target.disabled = false;
          const m = String(error.message || "");
          msg(m.includes("not found") ? tr("That code doesn't exist. Check it and try again.", "ไม่พบโค้ดนี้ ลองตรวจดูอีกครั้ง")
            : m.includes("already used") ? tr("That code was already used by another account.", "โค้ดนี้ถูกใช้กับบัญชีอื่นไปแล้ว")
            : tr("Couldn't move it. Try again.", "ย้ายไม่สำเร็จ ลองอีกครั้ง"));
          return;
        }
        msg(tr(`Done! Level ${data.level} is yours. Reloading…`, `เรียบร้อย! ได้เลเวล ${data.level} คืนแล้ว กำลังโหลดใหม่…`));
        setTimeout(() => location.reload(), 1200);
      };
    }
  };

  const user = {
    async id() { try { return (await session()).user.id; } catch (e) { console.warn("Off My Tiles: sign-in failed", e); return null; } },
    async me() { try { const u = (await session()).user; return { name: "", email: u.is_anonymous ? "" : (u.email || "") }; } catch (e) { return { name: "", email: "" }; } },
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
