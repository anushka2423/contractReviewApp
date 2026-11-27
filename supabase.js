// Supabase client for this app (no login, public insert-only access).
//
// The app is plain HTML with no build step, so there are no env vars: the
// project URL and PUBLISHABLE key are read from window.APP_CONFIG (config.js). The publishable (anon) key is
// designed to be public; access is limited by the table policies (RLS).
// NEVER put a service-role / secret key in this file.
(function () {
  var CFG = window.APP_CONFIG || {};
  var SUPABASE_URL = CFG.SUPABASE_URL;
  var SUPABASE_PUBLISHABLE_KEY = CFG.SUPABASE_ANON_KEY;

  // Insert one row. "return=minimal" matters: the feedback table has no public
  // SELECT policy, so asking Supabase to send the new row back would fail.
  function insert(table, row) {
    return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table), {
      method: "POST",
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(row)
    }).then(function (res) {
      if (res.ok) return;
      return res.text().then(function (text) {
        throw new Error("Supabase insert into " + table + " failed (" + res.status + "): " + text);
      });
    });
  }

  // Read rows (uses the anon key and the table's public SELECT policy only).
  // `params` is a plain object of PostgREST query parameters, e.g. {select: "a,b", limit: 10}.
  function select(table, params) {
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return fetch(SUPABASE_URL + "/rest/v1/" + encodeURIComponent(table) + (qs ? "?" + qs : ""), {
      headers: { "apikey": SUPABASE_PUBLISHABLE_KEY }
    }).then(function (res) {
      if (res.ok) return res.json();
      return res.text().then(function (text) {
        throw new Error("Supabase read from " + table + " failed (" + res.status + "): " + text);
      });
    });
  }

  window.AppSupabase = { insert: insert, select: select };
})();
