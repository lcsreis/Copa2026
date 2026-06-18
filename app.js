/* Copa 2026 — Figurinhas Repetidas
   Site estático, sem build.
   - `qty`:    mapa código -> quantidade que o DONO tem repetida (vem do data.json; editável com senha).
   - `wanted`: figurinhas que o VISITANTE escolheu (só local, para copiar pro WhatsApp). */

(function () {
  "use strict";

  var STORAGE_KEY = "copa2026.repeated";
  var WANTED_KEY = "copa2026.wanted";
  var EDIT_PASSWORD = "copa26";

  var state = {
    data: null,
    qty: new Map(),        // código -> quantidade (>= 1) do dono
    wanted: new Set(),     // do visitante
    baseline: new Set(),   // códigos repetidos na última versão publicada
    publishedNew: new Set(), // novidades já publicadas (data.new)
    order: "album",        // "album" | "alpha"
    filter: "all",         // "all" | "repeated" | "new"
    editing: false,
    search: "",
    animate: true,
    lastToggled: null
  };

  var editUnlocked = false;
  var els = {};

  /* ---------- estrutura ---------- */

  function teamCodes(team, perTeam) {
    var codes = [];
    for (var i = 1; i <= perTeam; i++) codes.push(team.code + i);
    return codes;
  }

  function baseGroups(data) {
    var perTeam = data.teamStickersPerTeam || 20;
    var arr = [];
    (data.sections || []).forEach(function (s) {
      arr.push({ key: s.id, name: s.name, flag: "📘", codes: s.codes, kind: "headerSpecial" });
    });
    (data.teams || []).forEach(function (t) {
      arr.push({ key: t.code, name: t.name, flag: t.flag || "🏳️", codes: teamCodes(t, perTeam), kind: "team" });
    });
    (data.specialsAfterTeams || []).forEach(function (s) {
      arr.push({ key: s.id, name: s.name, flag: "⭐", codes: s.codes, kind: "footerSpecial" });
    });
    return arr;
  }

  function buildGroups(data) {
    var base = baseGroups(data);
    if (state.order === "alpha") {
      var header = base.filter(function (g) { return g.kind === "headerSpecial"; });
      var teams = base.filter(function (g) { return g.kind === "team"; })
        .sort(function (a, b) { return a.name.localeCompare(b.name, "pt-BR"); });
      var footer = base.filter(function (g) { return g.kind === "footerSpecial"; });
      return header.concat(teams, footer);
    }
    return base;
  }

  function allCodesAlbumOrder(data) {
    var codes = [];
    baseGroups(data).forEach(function (g) { codes = codes.concat(g.codes); });
    return codes;
  }

  function matchesSearch(group, code) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    return code.toLowerCase().indexOf(q) !== -1 || group.name.toLowerCase().indexOf(q) !== -1;
  }

  // Aceita os dois formatos de `repeated`: array de códigos (qtd 1) ou objeto {código: qtd}.
  function toQtyMap(val) {
    var m = new Map();
    if (Array.isArray(val)) {
      val.forEach(function (c) { if (c) m.set(c, 1); });
    } else if (val && typeof val === "object") {
      Object.keys(val).forEach(function (c) {
        var n = parseInt(val[c], 10);
        if (n > 0) m.set(c, n);
      });
    }
    return m;
  }

  // Códigos repetidos atuais que ainda não estavam na última publicação.
  function addedSinceBaseline() {
    var s = new Set();
    state.qty.forEach(function (_n, code) { if (!state.baseline.has(code)) s.add(code); });
    return s;
  }

  // Conjunto exibido como "novo": preview ao vivo na edição; publicado na visualização.
  function currentNewSet() {
    return state.editing ? addedSinceBaseline() : state.publishedNew;
  }

  function qtyToObject() {
    var obj = {};
    allCodesAlbumOrder(state.data).forEach(function (code) {
      if (state.qty.has(code)) obj[code] = state.qty.get(code);
    });
    return obj;
  }

  /* ---------- persistência ---------- */

  function loadStoredQty() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return toQtyMap(JSON.parse(raw));
    } catch (e) { /* ignora */ }
    return null;
  }
  function saveQty() {
    try {
      var obj = {};
      state.qty.forEach(function (n, c) { obj[c] = n; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) { /* ignora */ }
  }
  function loadStoredWanted() {
    try {
      var raw = localStorage.getItem(WANTED_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) { /* ignora */ }
    return null;
  }
  function saveWanted() {
    try { localStorage.setItem(WANTED_KEY, JSON.stringify(Array.from(state.wanted))); } catch (e) { /* ignora */ }
  }

  /* ---------- render ---------- */

  function render() {
    var groups = buildGroups(state.data);
    var frag = document.createDocumentFragment();
    var anyVisible = false;
    var animIndex = 0;
    var newSet = currentNewSet();

    groups.forEach(function (group) {
      var visibleCodes = group.codes.filter(function (code) {
        if (state.filter === "repeated" && !state.qty.has(code)) return false;
        if (state.filter === "new" && !newSet.has(code)) return false;
        return matchesSearch(group, code);
      });
      if (visibleCodes.length === 0) return;
      anyVisible = true;

      var repeatedInGroup = group.codes.filter(function (c) { return state.qty.has(c); }).length;

      var section = document.createElement("section");
      section.className = "section" + (state.animate ? " animate-in" : "");
      if (state.animate) {
        section.style.animationDelay = Math.min(animIndex, 14) * 0.04 + "s";
        animIndex++;
      }

      var head = document.createElement("div");
      head.className = "section-head";
      var codeLabel = group.kind === "team"
        ? ' <span class="team-code">' + escapeHtml(group.key) + "</span>"
        : "";
      head.innerHTML =
        '<span class="flag">' + group.flag + "</span>" +
        "<h2>" + escapeHtml(group.name) + codeLabel + "</h2>" +
        '<span class="count' + (repeatedInGroup ? " has" : "") + '">' +
        (repeatedInGroup ? "⭐ " + repeatedInGroup : group.codes.length) +
        "</span>";
      section.appendChild(head);

      var chips = document.createElement("div");
      chips.className = "chips";
      visibleCodes.forEach(function (code) {
        var n = state.qty.get(code) || 0;
        var chip = document.createElement("button");
        chip.type = "button";
        var cls = "chip";
        if (n > 0) cls += " repeated";
        if (newSet.has(code)) cls += " new";
        if (state.wanted.has(code)) cls += " wanted";
        if (code === state.lastToggled) cls += " pulse";
        chip.className = cls;
        chip.dataset.code = code;

        // mostra o número: na edição sempre que >0; na visualização só quando >1
        var showNum = state.editing ? n > 0 : n > 1;
        var minus = (state.editing && n > 0)
          ? '<span class="chip-minus" data-act="dec" aria-label="tirar uma">−</span>'
          : "";
        var qtyLabel = showNum ? '<span class="qty">' + n + "</span>" : "";
        chip.innerHTML = minus + "<span class=\"chip-code\">" + escapeHtml(code) + "</span>" + qtyLabel;

        chips.appendChild(chip);
      });
      section.appendChild(chips);
      frag.appendChild(section);
    });

    els.content.innerHTML = "";
    if (!anyVisible) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.innerHTML = state.filter === "repeated"
        ? '<span class="big">📭</span>Nenhuma figurinha repetida ainda.'
        : state.filter === "new"
          ? '<span class="big">✨</span>Nenhuma novidade ainda.'
          : '<span class="big">🔍</span>Nada encontrado para essa busca.';
      els.content.appendChild(empty);
    } else {
      els.content.appendChild(frag);
    }

    state.lastToggled = null;
    updateCount();
    updateCartBar();
  }

  function updateCount() {
    var n = state.qty.size;
    var label = n + " repetida" + (n === 1 ? "" : "s");
    if (els.repeatedCount.textContent !== label) {
      els.repeatedCount.textContent = label;
      els.repeatedCount.classList.remove("bump");
      void els.repeatedCount.offsetWidth;
      els.repeatedCount.classList.add("bump");
    }
  }

  function updateCartBar() {
    var n = state.wanted.size;
    els.cartCount.textContent = n;
    var show = !state.editing && n > 0;
    els.cartBar.hidden = !show;
    document.body.classList.toggle("has-cart", show);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- ações do dono (quantidade) ---------- */

  function incQty(code) {
    state.qty.set(code, (state.qty.get(code) || 0) + 1);
    afterQtyChange(code);
  }
  function decQty(code) {
    var n = (state.qty.get(code) || 0) - 1;
    if (n <= 0) state.qty.delete(code);
    else state.qty.set(code, n);
    afterQtyChange(code);
  }
  function afterQtyChange(code) {
    state.lastToggled = code;
    state.animate = false;
    saveQty();
    render();
  }

  function buildExportData() {
    var out = JSON.parse(JSON.stringify(state.data));
    out.repeated = qtyToObject();
    out.new = allCodesAlbumOrder(state.data).filter(function (code) {
      return state.qty.has(code) && !state.baseline.has(code);
    });
    return out;
  }

  function exportJson() {
    var json = JSON.stringify(buildExportData(), null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("✅ data.json exportado. Substitua o arquivo e publique.");
  }

  function copyJson() {
    copyText(JSON.stringify(buildExportData(), null, 2),
      "📋 JSON copiado.", "Não foi possível copiar. Use Exportar.");
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (parsed.repeated !== undefined) state.qty = toQtyMap(parsed.repeated);
        if (parsed.teams && parsed.total) state.data = parsed;
        state.animate = true;
        saveQty();
        render();
        toast("⬆ Importado: " + state.qty.size + " repetidas.");
      } catch (e) {
        toast("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- ações do visitante ---------- */

  function toggleWanted(code) {
    if (!state.qty.has(code)) return; // só repetidas podem ser escolhidas
    if (state.wanted.has(code)) state.wanted.delete(code);
    else state.wanted.add(code);
    state.lastToggled = code;
    state.animate = false;
    saveWanted();
    render();
  }

  function clearWanted() {
    state.wanted.clear();
    saveWanted();
    state.animate = false;
    render();
  }

  function buildWantedText() {
    var lines = ["🏆 *Copa 2026* — figurinhas que eu quero", ""];
    var total = 0;
    baseGroups(state.data).forEach(function (g) {
      var picked = g.codes.filter(function (c) { return state.wanted.has(c); });
      if (picked.length) {
        lines.push(g.flag + " *" + g.name + "*: " + picked.join(", "));
        total += picked.length;
      }
    });
    lines.push("");
    lines.push("Total: " + total + " figurinha" + (total === 1 ? "" : "s"));
    return lines.join("\n");
  }

  function copyWanted() {
    if (state.wanted.size === 0) return;
    copyText(buildWantedText(),
      "✅ Figurinhas copiadas! Só colar no WhatsApp para solicitar a reserva 📲",
      "Não consegui copiar automaticamente — segue o texto para copiar.");
  }

  /* ---------- helpers de UI ---------- */

  function copyText(text, okMsg, failMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast(okMsg); },
        function () { fallbackCopy(text, failMsg); }
      );
    } else {
      fallbackCopy(text, failMsg);
    }
  }

  function fallbackCopy(text, failMsg) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      toast(ok ? "✅ Copiado! Cole no WhatsApp 📲" : failMsg);
      if (!ok) window.prompt("Copie o texto:", text);
    } catch (e) {
      window.prompt("Copie o texto:", text);
    }
  }

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 3400);
  }

  function setActive(group, activeBtn) {
    Array.prototype.forEach.call(group.querySelectorAll(".seg-btn"), function (b) {
      b.classList.toggle("active", b === activeBtn);
    });
  }

  /* ---------- eventos ---------- */

  var searchTimer = null;
  function bindEvents() {
    els.search.addEventListener("input", function () {
      var val = this.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = val;
        state.animate = false;
        render();
      }, 130);
    });

    Array.prototype.forEach.call(els.filterSeg.querySelectorAll(".seg-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.dataset.filter || "all";
        setActive(els.filterSeg, btn);
        state.animate = true;
        render();
      });
    });

    Array.prototype.forEach.call(els.orderSeg.querySelectorAll(".seg-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.order = btn.dataset.order;
        setActive(els.orderSeg, btn);
        state.animate = true;
        render();
      });
    });

    els.toolsToggle.addEventListener("click", function () {
      var open = els.tools.hidden;
      els.tools.hidden = !open;
      els.toolsToggle.setAttribute("aria-expanded", String(open));
    });

    els.editMode.addEventListener("change", function () {
      if (this.checked && !editUnlocked) {
        var pw = window.prompt("Senha para editar:");
        if (pw !== EDIT_PASSWORD) {
          this.checked = false;
          if (pw !== null) toast("🔒 Senha incorreta.");
          return;
        }
        editUnlocked = true;
      }
      state.editing = this.checked;
      document.body.classList.toggle("editing", state.editing);
      els.editHint.hidden = !state.editing;
      els.intro.hidden = state.editing;
      render();
    });

    // Clique num chip.
    els.content.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var code = chip.dataset.code;
      if (state.editing) {
        if (e.target.closest('[data-act="dec"]')) decQty(code);
        else incQty(code);
        return;
      }
      toggleWanted(code);
    });

    els.exportBtn.addEventListener("click", exportJson);
    els.copyBtn.addEventListener("click", copyJson);
    els.importInput.addEventListener("change", function () {
      if (this.files && this.files[0]) importJson(this.files[0]);
      this.value = "";
    });

    els.copyWanted.addEventListener("click", copyWanted);
    els.cartClear.addEventListener("click", clearWanted);

    els.reloadPublished.addEventListener("click", function () {
      if (!window.confirm("Descartar as marcações salvas neste aparelho e carregar a versão publicada do site?")) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
      location.reload();
    });
  }

  /* ---------- init ---------- */

  function init() {
    els = {
      content: document.getElementById("content"),
      repeatedCount: document.getElementById("repeated-count"),
      albumKey: document.getElementById("album-key"),
      search: document.getElementById("search"),
      filterSeg: document.getElementById("filter-seg"),
      orderSeg: document.getElementById("order-seg"),
      toolsToggle: document.getElementById("tools-toggle"),
      tools: document.getElementById("tools"),
      editMode: document.getElementById("edit-mode"),
      editHint: document.getElementById("edit-hint"),
      intro: document.getElementById("intro"),
      exportBtn: document.getElementById("export-btn"),
      copyBtn: document.getElementById("copy-btn"),
      importInput: document.getElementById("import-input"),
      reloadPublished: document.getElementById("reload-published"),
      cartBar: document.getElementById("cart-bar"),
      cartCount: document.getElementById("cart-count"),
      cartClear: document.getElementById("cart-clear"),
      copyWanted: document.getElementById("copy-wanted"),
      toast: document.getElementById("toast")
    };

    bindEvents();
    state.wanted = loadStoredWanted() || new Set();

    fetch("data.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        els.albumKey.textContent = data.albumKey || "—";
        // baseline = o que estava publicado (antes de aplicar o override local)
        state.baseline = new Set(toQtyMap(data.repeated).keys());
        state.publishedNew = new Set(Array.isArray(data.new) ? data.new : []);
        var stored = loadStoredQty();
        state.qty = stored || toQtyMap(data.repeated);
        render();
      })
      .catch(function (err) {
        els.content.innerHTML =
          '<p class="empty"><span class="big">⚠️</span>Erro ao carregar data.json (' +
          escapeHtml(err.message) + ").</p>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
