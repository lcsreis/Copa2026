/* Copa 2026 — Figurinhas Repetidas
   Site estático, sem build. Os dados vêm de data.json; as marcações de
   "repetida" ficam em localStorage até serem exportadas de volta para o JSON. */

(function () {
  "use strict";

  var STORAGE_KEY = "copa2026.repeated";

  var state = {
    data: null,          // conteúdo do data.json
    repeated: new Set(), // códigos marcados como repetidos
    order: "album",      // "album" | "alpha"
    onlyRepeated: false,
    editing: false,
    search: "",
    animate: true,       // anima entrada das seções (desligado ao digitar busca)
    lastToggled: null    // código que acabou de mudar (para o pulse)
  };

  var els = {};

  /* ---------- utilidades ---------- */

  // Gera os códigos de uma seleção: CODE1..CODE20
  function teamCodes(team, perTeam) {
    var codes = [];
    for (var i = 1; i <= perTeam; i++) codes.push(team.code + i);
    return codes;
  }

  // Monta a lista de "grupos" a exibir: { key, name, flag, codes[] }
  function buildGroups(data) {
    var perTeam = data.teamStickersPerTeam || 20;
    var headerSpecials = (data.sections || []).map(function (s) {
      return { key: s.id, name: s.name, flag: "📘", codes: s.codes, kind: "special" };
    });
    var teamGroups = (data.teams || []).map(function (t) {
      return { key: t.code, name: t.name, flag: t.flag || "🏳️", codes: teamCodes(t, perTeam), kind: "team" };
    });
    var footerSpecials = (data.specialsAfterTeams || []).map(function (s) {
      return { key: s.id, name: s.name, flag: "⭐", codes: s.codes, kind: "special" };
    });

    if (state.order === "alpha") {
      // Alfabética por seleção, ignorando os grupos/seções.
      // Especiais de cabeçalho no topo, seleções ordenadas no meio, demais especiais no fim.
      var sortedTeams = teamGroups.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, "pt-BR");
      });
      return headerSpecials.concat(sortedTeams, footerSpecials);
    }
    // Ordem do álbum (padrão)
    return headerSpecials.concat(teamGroups, footerSpecials);
  }

  function matchesSearch(group, code) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    return code.toLowerCase().indexOf(q) !== -1 || group.name.toLowerCase().indexOf(q) !== -1;
  }

  /* ---------- persistência ---------- */

  function loadStoredRepeated() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) { /* ignora */ }
    return null;
  }

  function saveRepeated() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.repeated)));
    } catch (e) { /* ignora */ }
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

    state.lastToggled = null; // o pulse acontece só uma vez
    updateCount();
  }

  function updateCount() {
    var n = state.repeated.size;
    var label = n + " repetida" + (n === 1 ? "" : "s");
    if (els.repeatedCount.textContent !== label) {
      els.repeatedCount.textContent = label;
      els.repeatedCount.classList.remove("bump");
      void els.repeatedCount.offsetWidth; // reinicia a animação
      els.repeatedCount.classList.add("bump");
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- ações ---------- */

  function toggleCode(code) {
    if (state.repeated.has(code)) state.repeated.delete(code);
    else state.repeated.add(code);
    state.lastToggled = code;
    state.animate = false; // não re-anima as seções ao marcar
    saveRepeated();
    render();
  }

  // Lista plana de todos os códigos na ordem do álbum (para exportar ordenado).
  function allCodesAlbumOrder(data) {
    var perTeam = data.teamStickersPerTeam || 20;
    var codes = [];
    (data.sections || []).forEach(function (s) { codes = codes.concat(s.codes); });
    (data.teams || []).forEach(function (t) { codes = codes.concat(teamCodes(t, perTeam)); });
    (data.specialsAfterTeams || []).forEach(function (s) { codes = codes.concat(s.codes); });
    return codes;
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
    var json = JSON.stringify(buildExportData(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () { toast("📋 JSON copiado."); },
        function () { toast("Não foi possível copiar. Use Exportar."); }
      );
    } else {
      toast("Cópia não suportada. Use Exportar.");
    }
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.repeated)) state.repeated = new Set(parsed.repeated);
        if (parsed.teams && parsed.total) state.data = parsed;
        state.animate = true;
        saveRepeated();
        render();
        toast("⬆ Importado: " + state.repeated.size + " repetidas.");
      } catch (e) {
        toast("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  var toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 3200);
  }

  /* ---------- eventos ---------- */

  var searchTimer = null;
  function bindEvents() {
    els.search.addEventListener("input", function () {
      var val = this.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = val;
        state.animate = false; // digitar não re-anima
        render();
      }, 130);
    });

    // Filtro segmentado (Todas / Só repetidas)
    Array.prototype.forEach.call(els.filterSeg.querySelectorAll(".seg-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.onlyRepeated = btn.dataset.filter === "repeated";
        setActive(els.filterSeg, btn);
        state.animate = true;
        render();
      });
    });

    // Ordenação (Álbum / A–Z)
    Array.prototype.forEach.call(els.orderSeg.querySelectorAll(".seg-btn"), function (btn) {
      btn.addEventListener("click", function () {
        state.order = btn.dataset.order;
        setActive(els.orderSeg, btn);
        state.animate = true;
        render();
      });
    });

    // Painel de ferramentas (dono)
    els.toolsToggle.addEventListener("click", function () {
      var open = els.tools.hidden;
      els.tools.hidden = !open;
      els.toolsToggle.setAttribute("aria-expanded", String(open));
    });

    els.editMode.addEventListener("change", function () {
      state.editing = this.checked;
      document.body.classList.toggle("editing", state.editing);
      els.editHint.hidden = !state.editing;
    });

    // Delegação: clique num chip (só no modo edição).
    els.content.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip || !state.editing) return;
      toggleCode(chip.dataset.code);
    });

    els.exportBtn.addEventListener("click", exportJson);
    els.copyBtn.addEventListener("click", copyJson);
    els.importInput.addEventListener("change", function () {
      if (this.files && this.files[0]) importJson(this.files[0]);
      this.value = "";
    });
  }

  function setActive(group, activeBtn) {
    Array.prototype.forEach.call(group.querySelectorAll(".seg-btn"), function (b) {
      b.classList.toggle("active", b === activeBtn);
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
      exportBtn: document.getElementById("export-btn"),
      copyBtn: document.getElementById("copy-btn"),
      importInput: document.getElementById("import-input"),
      toast: document.getElementById("toast")
    };

    bindEvents();

    fetch("data.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        state.data = data;
        els.albumKey.textContent = data.albumKey || "—";

        // Marcações locais têm prioridade; senão usa as do JSON publicado.
        var stored = loadStoredRepeated();
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
