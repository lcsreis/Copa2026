/* Copa 2026 — Figurinhas Repetidas
   Site estático, sem build.
   - `repeated`: figurinhas que o DONO tem repetidas (vêm do data.json; editáveis com senha).
   - `wanted`:   figurinhas que o VISITANTE escolheu (só local, para copiar pro WhatsApp). */

(function () {
  "use strict";

  var STORAGE_KEY = "copa2026.repeated";
  var WANTED_KEY = "copa2026.wanted";
  var EDIT_PASSWORD = "copa26";

  var state = {
    data: null,
    repeated: new Set(),   // do dono
    wanted: new Set(),     // do visitante
    order: "album",        // "album" | "alpha"
    onlyRepeated: false,
    editing: false,
    search: "",
    animate: true,
    lastToggled: null
  };

  var editUnlocked = false; // senha já validada nesta sessão
  var els = {};

  /* ---------- estrutura ---------- */

  function teamCodes(team, perTeam) {
    var codes = [];
    for (var i = 1; i <= perTeam; i++) codes.push(team.code + i);
    return codes;
  }

  // Lista base (ordem do álbum) com nome/bandeira/códigos de cada grupo.
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

  /* ---------- persistência ---------- */

  function loadSet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) { /* ignora */ }
    return null;
  }
  function saveSet(key, set) {
    try { localStorage.setItem(key, JSON.stringify(Array.from(set))); } catch (e) { /* ignora */ }
  }

  /* ---------- render ---------- */

  function render() {
    var groups = buildGroups(state.data);
    var frag = document.createDocumentFragment();
    var anyVisible = false;
    var animIndex = 0;

    groups.forEach(function (group) {
      var visibleCodes = group.codes.filter(function (code) {
        if (state.onlyRepeated && !state.repeated.has(code)) return false;
        return matchesSearch(group, code);
      });
      if (visibleCodes.length === 0) return;
      anyVisible = true;

      var repeatedInGroup = group.codes.filter(function (c) { return state.repeated.has(c); }).length;

      var section = document.createElement("section");
      section.className = "section" + (state.animate ? " animate-in" : "");
      if (state.animate) {
        section.style.animationDelay = Math.min(animIndex, 14) * 0.04 + "s";
        animIndex++;
      }

      var head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML =
        '<span class="flag">' + group.flag + "</span>" +
        "<h2>" + escapeHtml(group.name) + "</h2>" +
        '<span class="count' + (repeatedInGroup ? " has" : "") + '">' +
        (repeatedInGroup ? "⭐ " + repeatedInGroup : group.codes.length) +
        "</span>";
      section.appendChild(head);

      var chips = document.createElement("div");
      chips.className = "chips";
      visibleCodes.forEach(function (code) {
        var chip = document.createElement("button");
        chip.type = "button";
        var cls = "chip";
        if (state.repeated.has(code)) cls += " repeated";
        if (state.wanted.has(code)) cls += " wanted";
        if (code === state.lastToggled) cls += " pulse";
        chip.className = cls;
        chip.textContent = code;
        chip.dataset.code = code;
        chips.appendChild(chip);
      });
      section.appendChild(chips);
      frag.appendChild(section);
    });

    els.content.innerHTML = "";
    if (!anyVisible) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.innerHTML = state.onlyRepeated
        ? '<span class="big">📭</span>Nenhuma figurinha repetida ainda.'
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
    var n = state.repeated.size;
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

  /* ---------- ações do dono ---------- */

  function toggleRepeated(code) {
    if (state.repeated.has(code)) state.repeated.delete(code);
    else state.repeated.add(code);
    state.lastToggled = code;
    state.animate = false;
    saveSet(STORAGE_KEY, state.repeated);
    render();
  }

  function buildExportData() {
    var out = JSON.parse(JSON.stringify(state.data));
    out.repeated = allCodesAlbumOrder(state.data).filter(function (code) {
      return state.repeated.has(code);
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
        if (Array.isArray(parsed.repeated)) state.repeated = new Set(parsed.repeated);
        if (parsed.teams && parsed.total) state.data = parsed;
        state.animate = true;
        saveSet(STORAGE_KEY, state.repeated);
        render();
        toast("⬆ Importado: " + state.repeated.size + " repetidas.");
      } catch (e) {
        toast("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- ações do visitante ---------- */

  function toggleWanted(code) {
    if (!state.repeated.has(code)) return; // só repetidas podem ser escolhidas
    if (state.wanted.has(code)) state.wanted.delete(code);
    else state.wanted.add(code);
    state.lastToggled = code;
    state.animate = false;
    saveSet(WANTED_KEY, state.wanted);
    render();
  }

  function clearWanted() {
    state.wanted.clear();
    saveSet(WANTED_KEY, state.wanted);
    state.animate = false;
    render();
  }

  // Monta o texto agrupado por seleção, na ordem do álbum.
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
        state.onlyRepeated = btn.dataset.filter === "repeated";
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

    // Modo edição protegido por senha.
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
      updateCartBar();
    });

    // Clique num chip.
    els.content.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var code = chip.dataset.code;
      if (state.editing) toggleRepeated(code);
      else toggleWanted(code);
    });

    els.exportBtn.addEventListener("click", exportJson);
    els.copyBtn.addEventListener("click", copyJson);
    els.importInput.addEventListener("change", function () {
      if (this.files && this.files[0]) importJson(this.files[0]);
      this.value = "";
    });

    els.copyWanted.addEventListener("click", copyWanted);
    els.cartClear.addEventListener("click", clearWanted);
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
      cartBar: document.getElementById("cart-bar"),
      cartCount: document.getElementById("cart-count"),
      cartClear: document.getElementById("cart-clear"),
      copyWanted: document.getElementById("copy-wanted"),
      toast: document.getElementById("toast")
    };

    bindEvents();
    state.wanted = loadSet(WANTED_KEY) || new Set();

    fetch("data.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        els.albumKey.textContent = data.albumKey || "—";
        var stored = loadSet(STORAGE_KEY);
        state.repeated = stored || new Set(data.repeated || []);
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
