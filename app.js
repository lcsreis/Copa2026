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
    search: ""
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

    groups.forEach(function (group) {
      var visibleCodes = group.codes.filter(function (code) {
        if (state.onlyRepeated && !state.repeated.has(code)) return false;
        return matchesSearch(group, code);
      });
      if (visibleCodes.length === 0) return;
      anyVisible = true;

      var section = document.createElement("section");
      section.className = "section";

      var repeatedInGroup = group.codes.filter(function (c) { return state.repeated.has(c); }).length;

      var head = document.createElement("div");
      head.className = "section-head";
      head.innerHTML =
        '<span class="flag">' + group.flag + "</span>" +
        "<h2>" + escapeHtml(group.name) + "</h2>" +
        '<span class="count">' + repeatedInGroup + "/" + group.codes.length + " rep.</span>";
      section.appendChild(head);

      var chips = document.createElement("div");
      chips.className = "chips";
      visibleCodes.forEach(function (code) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (state.repeated.has(code) ? " repeated" : "");
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
      empty.textContent = state.onlyRepeated
        ? "Nenhuma figurinha repetida marcada ainda."
        : "Nada encontrado para essa busca.";
      els.content.appendChild(empty);
    } else {
      els.content.appendChild(frag);
    }

    updateCount();
  }

  function updateCount() {
    els.repeatedCount.textContent = state.repeated.size + " repetida" + (state.repeated.size === 1 ? "" : "s");
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
    saveRepeated();
    render();
  }

  function buildExportData() {
    var out = JSON.parse(JSON.stringify(state.data));
    // Mantém só os códigos válidos do catálogo, em ordem do álbum.
    var all = buildGroupsForExport(state.data);
    out.repeated = all.filter(function (code) { return state.repeated.has(code); });
    return out;
  }

  // Lista plana de todos os códigos na ordem do álbum (para exportar ordenado).
  function buildGroupsForExport(data) {
    var perTeam = data.teamStickersPerTeam || 20;
    var codes = [];
    (data.sections || []).forEach(function (s) { codes = codes.concat(s.codes); });
    (data.teams || []).forEach(function (t) { codes = codes.concat(teamCodes(t, perTeam)); });
    (data.specialsAfterTeams || []).forEach(function (s) { codes = codes.concat(s.codes); });
    return codes;
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
    toast("data.json exportado. Substitua o arquivo do site e publique.");
  }

  function copyJson() {
    var json = JSON.stringify(buildExportData(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () { toast("JSON copiado para a área de transferência."); },
        function () { toast("Não foi possível copiar. Use Exportar."); }
      );
    } else {
      toast("Cópia não suportada neste navegador. Use Exportar.");
    }
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed.repeated)) {
          state.repeated = new Set(parsed.repeated);
        }
        // Se o catálogo também veio, atualiza (permite trocar o data.json inteiro).
        if (parsed.teams && parsed.total) state.data = parsed;
        saveRepeated();
        render();
        toast("JSON importado: " + state.repeated.size + " repetidas.");
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

  function bindEvents() {
    els.search.addEventListener("input", function () {
      state.search = this.value.trim();
      render();
    });

    els.onlyRepeated.addEventListener("change", function () {
      state.onlyRepeated = this.checked;
      render();
    });

    els.editMode.addEventListener("change", function () {
      state.editing = this.checked;
      document.body.classList.toggle("editing", state.editing);
      els.editHint.hidden = !state.editing;
    });

    Array.prototype.forEach.call(els.segButtons, function (btn) {
      btn.addEventListener("click", function () {
        state.order = btn.dataset.order;
        Array.prototype.forEach.call(els.segButtons, function (b) {
          b.classList.toggle("active", b === btn);
        });
        render();
      });
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

  /* ---------- init ---------- */

  function init() {
    els = {
      content: document.getElementById("content"),
      repeatedCount: document.getElementById("repeated-count"),
      albumKey: document.getElementById("album-key"),
      search: document.getElementById("search"),
      onlyRepeated: document.getElementById("only-repeated"),
      editMode: document.getElementById("edit-mode"),
      editHint: document.getElementById("edit-hint"),
      segButtons: document.querySelectorAll(".seg-btn"),
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
          '<p class="empty">Erro ao carregar data.json (' + escapeHtml(err.message) +
          "). Abra o site por um servidor (não via file://).</p>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
