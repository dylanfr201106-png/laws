(function () {
  "use strict";

  const MOD_ID = "tax_law_control";
  const PANEL_ID = "gt-tax-law-control-panel";

  try {
    window.$wt = window.$wt || {};
    window.$wt.modsLoaded = window.$wt.modsLoaded || [];
    if (window.$wt.modsLoaded.includes(MOD_ID)) return;
    window.$wt.modsLoaded.push(MOD_ID);
  } catch (e) {}

  function log(msg) {
    try {
      if (typeof logMessage === "function") return logMessage(msg);
      if (window.$wt && typeof window.$wt.notify === "function") return window.$wt.notify(msg);
    } catch (e) {}
    console.log("[" + MOD_ID + "] " + msg);
  }

  function clamp(num, min, max) {
    num = Number(num);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
  }

  function titleCase(str) {
    return String(str || "")
      .replace(/[_-]+/g, " ")
      .replace(/\w\S*/g, function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getAllTowns() {
    try {
      if (typeof regFilter === "function") {
        const towns = regFilter("town", function () {
          return true;
        });
        if (Array.isArray(towns)) return towns;
      }
    } catch (e) {}

    try {
      if (Array.isArray(window.towns)) return window.towns;
    } catch (e) {}

    try {
      if (window.regs && Array.isArray(window.regs.town)) return window.regs.town;
    } catch (e) {}

    try {
      if (window.planet && Array.isArray(window.planet.towns)) return window.planet.towns;
    } catch (e) {}

    return [];
  }

  function getSelectedTown() {
    const candidates = [
      window.selectedTown,
      window.activeTown,
      window.openTown,
      window.currentTown,
      window.inspectTown,
      window.selectedReg,
      window.activeReg,
      window.currentReg,
      window.viewingReg,
      window.subpanelReg,
      window.infoReg
    ];

    for (const t of candidates) {
      if (t && (t.type === "town" || t.reg === "town" || "pop" in t || "population" in t)) return t;
    }

    const idCandidates = [
      window.selectedTownId,
      window.activeTownId,
      window.openTownId,
      window.currentTownId,
      window.selectedRegId
    ];

    const towns = getAllTowns();

    for (const id of idCandidates) {
      if (id === undefined || id === null) continue;
      const found = towns.find(function (t) {
        return t.id == id || t.name == id;
      });
      if (found) return found;
    }

    const panelText = document.body ? document.body.innerText : "";

    if (panelText) {
      const visible = towns.find(function (t) {
        return t && t.name && panelText.includes(t.name);
      });
      if (visible) return visible;
    }

    return null;
  }

  function getTaxRate(town) {
    if (!town) return 0;

    const paths = [
      ["taxRate"],
      ["tax"],
      ["taxes"],
      ["incomeTax"],
      ["propertyTax"],
      ["economy", "taxRate"],
      ["economy", "tax"],
      ["currency", "taxRate"],
      ["government", "taxRate"],
      ["modTaxRate"]
    ];

    for (const path of paths) {
      let obj = town;

      for (const key of path) {
        obj = obj && obj[key];
      }

      if (typeof obj === "number") {
        return obj <= 1 ? Math.round(obj * 100) : Math.round(obj);
      }
    }

    return Number(town.modTaxRate || 0);
  }

  function setTaxRate(town, percent) {
    if (!town) return;

    percent = clamp(percent, 0, 100);
    town.modTaxRate = percent;

    const percentFields = ["taxRate", "tax", "taxes", "incomeTax", "propertyTax"];

    for (const key of percentFields) {
      if (typeof town[key] === "number") town[key] = percent;
    }

    if (town.economy && typeof town.economy === "object") {
      if (typeof town.economy.taxRate === "number") town.economy.taxRate = percent;
      if (typeof town.economy.tax === "number") town.economy.tax = percent;
    }

    if (town.currency && typeof town.currency === "object" && typeof town.currency.taxRate === "number") {
      town.currency.taxRate = percent;
    }

    if (town.government && typeof town.government === "object" && typeof town.government.taxRate === "number") {
      town.government.taxRate = percent;
    }

    try {
      window.dispatchEvent(new CustomEvent("gentown:taxChanged", { detail: { town: town, percent: percent } }));
    } catch (e) {}
  }

  function getLawObject(town) {
    if (!town) return null;
    if (town.laws && typeof town.laws === "object") return town.laws;
    if (town.law && typeof town.law === "object") return town.law;
    if (town.government && town.government.laws && typeof town.government.laws === "object") return town.government.laws;
    if (town.policies && typeof town.policies === "object") return town.policies;
    return null;
  }

  function ensureLawOverrides(town) {
    if (!town.modLawOverrides || typeof town.modLawOverrides !== "object") town.modLawOverrides = {};
    return town.modLawOverrides;
  }

  function listLaws(town) {
    const vanilla = getLawObject(town) || {};
    const overrides = ensureLawOverrides(town);
    const names = new Set(Object.keys(vanilla).concat(Object.keys(overrides)));
    return Array.from(names).sort();
  }

  function getLawState(town, lawName) {
    const overrides = ensureLawOverrides(town);

    if (lawName in overrides) return overrides[lawName] ? "legal" : "illegal";

    const laws = getLawObject(town) || {};
    const value = laws[lawName];

    if (typeof value === "boolean") return value ? "legal" : "illegal";

    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (["legal", "allowed", "true", "yes"].includes(lower)) return "legal";
      if (["illegal", "banned", "false", "no"].includes(lower)) return "illegal";
    }

    return value ? "legal" : "illegal";
  }

  function setLawState(town, lawName, state) {
    if (!town || !lawName) return;

    const legal = state === "legal";
    const overrides = ensureLawOverrides(town);
    overrides[lawName] = legal;

    const laws = getLawObject(town);

    if (laws && typeof laws === "object") {
      if (lawName in laws) {
        if (typeof laws[lawName] === "string") laws[lawName] = legal ? "legal" : "illegal";
        else laws[lawName] = legal;
      } else {
        laws[lawName] = legal;
      }
    } else {
      town.laws = {};
      town.laws[lawName] = legal;
    }

    try {
      window.dispatchEvent(new CustomEvent("gentown:lawChanged", { detail: { town: town, lawName: lawName, legal: legal } }));
    } catch (e) {}
  }

  let lastDaySeen = null;

  const LAW_EFFECTS = {
    slavery: { mood: -1.5, revolt: 0.4, wealth: 0.04 },
    forced_labor: { mood: -1.3, revolt: 0.35, wealth: 0.03 },
    free_speech: { mood: 0.8, revolt: -0.2 },
    censorship: { mood: -0.8, revolt: 0.25 },
    weapons: { mood: -0.2, revolt: 0.15, crime: 0.25 },
    alcohol: { mood: 0.3, crime: 0.15 },
    religion: { mood: 0.25, revolt: -0.1 },
    immigration: { mood: -0.1, wealth: 0.015, growth: 0.2 },
    healthcare: { mood: 0.8, growth: 0.15, wealth: -0.01 },
    education: { mood: 0.5, wealth: 0.02 },
    police: { mood: -0.3, revolt: -0.25, crime: -0.4 },
    unions: { mood: 0.5, wealth: -0.015, revolt: -0.1 },
    gambling: { mood: 0.3, crime: 0.2, wealth: 0.01 },
    drugs: { mood: -0.3, crime: 0.4, wealth: 0.015 },
    private_property: { mood: 0.2, wealth: 0.025 },
    monarchy: { mood: -0.4, revolt: 0.2 },
    dictatorship: { mood: -1.2, revolt: 0.5, crime: -0.1 },
    democracy: { mood: 0.9, revolt: -0.25 }
  };

  function getStatKey(town, possibleKeys) {
    for (const key of possibleKeys) {
      if (typeof town[key] === "number") return key;
    }
    return null;
  }

  function addToTownStat(town, possibleKeys, amount, min, max) {
    const key = getStatKey(town, possibleKeys);
    if (!key) return false;
    town[key] = clamp(town[key] + amount, min, max);
    return true;
  }

  function applyMoodAndLawEffects(town) {
    if (!town) return;

    const taxRate = Number(town.modTaxRate || 0);

    if (taxRate > 0) {
      if (taxRate <= 15) addToTownStat(town, ["mood", "happiness", "morale"], 0.05, -10, 10);
      if (taxRate > 35) addToTownStat(town, ["mood", "happiness", "morale"], -0.15 * (taxRate / 35), -10, 10);
      if (taxRate > 55) addToTownStat(town, ["revolt", "revoltChance", "unrest", "rebellion"], 0.1 * (taxRate / 55), 0, 100);
    }

    const overrides = ensureLawOverrides(town);

    for (const lawName in overrides) {
      const isLegal = overrides[lawName];
      const effect = LAW_EFFECTS[lawName];

      if (!effect) continue;

      const dir = isLegal ? 1 : -1;

      if (effect.mood) addToTownStat(town, ["mood", "happiness", "morale"], effect.mood * dir, -10, 10);
      if (effect.revolt) addToTownStat(town, ["revolt", "revoltChance", "unrest", "rebellion"], effect.revolt * dir, 0, 100);
      if (effect.crime) addToTownStat(town, ["crime", "crimeRate"], effect.crime * dir, 0, 100);
      if (effect.growth) addToTownStat(town, ["growth", "growthRate", "popGrowth"], effect.growth * dir, -100, 100);

      if (effect.wealth) {
        const wealthKey = getStatKey(town, ["privateWealth", "wealth"]);

        if (wealthKey) {
          town[wealthKey] = Math.max(0, town[wealthKey] * (1 + effect.wealth * dir * 0.002));
        }
      }
    }
  }

  function applyDailyTaxes() {
    let day = null;

    try {
      day = window.day ?? window.days ?? window.currentDay ?? (window.planet && window.planet.day);
    } catch (e) {}

    if (day === null || day === undefined || day === lastDaySeen) return;

    lastDaySeen = day;

    const towns = getAllTowns();

    for (const town of towns) {
      const rate = Number(town.modTaxRate || 0);

      if (rate) {
        const wealthKey = typeof town.privateWealth === "number" ? "privateWealth" : null;
        const treasuryKey = typeof town.cash === "number" ? "cash" : typeof town.money === "number" ? "money" : null;
        const pop = Number(town.pop || town.population || 0);

        if (wealthKey && treasuryKey) {
          const base = Math.max(0, town[wealthKey]);
          const collected = Math.floor((base * (rate / 100)) / 365);

          if (collected > 0) {
            town[wealthKey] = Math.max(0, town[wealthKey] - collected);
            town[treasuryKey] += collected;
          }
        } else if (treasuryKey && pop > 0) {
          town[treasuryKey] += Math.floor(pop * (rate / 100));
        }
      }

      applyMoodAndLawEffects(town);
    }
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);

    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.border = "1px solid #777";
    panel.style.borderRadius = "8px";
    panel.style.padding = "10px";
    panel.style.margin = "10px 0";
    panel.style.background = "rgba(0,0,0,0.08)";
    panel.style.fontFamily = "inherit";
    panel.style.fontSize = "14px";

    document.body.appendChild(panel);

    return panel;
  }

  function findBestInsertionParent() {
    const all = Array.from(document.querySelectorAll("div, section, aside, main"));

    const scored = all
      .map(function (el) {
        const text = (el.innerText || "").toLowerCase();
        let score = 0;

        if (text.includes("currency")) score += 4;
        if (text.includes("economic system")) score += 4;
        if (text.includes("laws")) score += 4;
        if (text.includes("population")) score += 1;
        if (text.includes("resources")) score += 1;

        return { el: el, score: score, len: text.length };
      })
      .filter(function (x) {
        return x.score > 0 && x.len < 8000;
      })
      .sort(function (a, b) {
        return b.score - a.score || a.len - b.len;
      });

    return scored[0] ? scored[0].el : document.body;
  }

  function renderPanel() {
    const town = getSelectedTown();
    let panel = document.getElementById(PANEL_ID);

    if (!town) {
      if (panel) panel.style.display = "none";
      return;
    }

    panel = createPanel();
    panel.style.display = "block";

    const townName = town.name || "Town";
    const currentTax = getTaxRate(town);
    const laws = listLaws(town);

    panel.innerHTML =
      '<div style="font-weight:bold;font-size:16px;margin-bottom:6px;">Town Controls: ' +
      escapeHtml(townName) +
      '</div>' +
      '<div style="margin-bottom:10px;">' +
      '<label style="display:block;font-weight:bold;">Tax Rate: <span id="gt-tax-law-tax-label">' +
      currentTax +
      "%</span></label>" +
      '<input id="gt-tax-law-tax" type="range" min="0" max="100" step="1" value="' +
      currentTax +
      '" style="width:100%;">' +
      '<input id="gt-tax-law-tax-number" type="number" min="0" max="100" step="1" value="' +
      currentTax +
      '" style="width:80px;margin-top:4px;"> % ' +
      '<button id="gt-tax-law-apply-tax">Apply Tax</button>' +
      "</div>" +
      '<div style="margin-bottom:8px;font-weight:bold;">Laws</div>' +
      '<div id="gt-tax-law-list"></div>' +
      '<div style="margin-top:8px;border-top:1px solid #777;padding-top:8px;">' +
      '<input id="gt-tax-law-new-name" placeholder="new law name like democracy" style="min-width:220px;"> ' +
      '<select id="gt-tax-law-new-state">' +
      '<option value="legal">Legal</option>' +
      '<option value="illegal">Illegal</option>' +
      "</select> " +
      '<button id="gt-tax-law-add">Add / Set Law</button>' +
      "</div>";

    const list = panel.querySelector("#gt-tax-law-list");

    if (!laws.length) {
      list.innerHTML = '<div style="opacity:.8;">No laws detected yet. Add a law below.</div>';
    } else {
      for (const law of laws) {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "8px";
        row.style.alignItems = "center";
        row.style.margin = "4px 0";

        row.innerHTML =
          '<span style="flex:1;">' +
          escapeHtml(titleCase(law)) +
          "</span>" +
          '<select data-law="' +
          escapeHtml(law) +
          '">' +
          '<option value="legal">Legal</option>' +
          '<option value="illegal">Illegal</option>' +
          "</select>";

        const select = row.querySelector("select");

        select.value = getLawState(town, law);

        select.addEventListener("change", function () {
          setLawState(town, law, select.value);
          log(townName + ": " + titleCase(law) + " is now " + select.value + ".");
        });

        list.appendChild(row);
      }
    }

    const slider = panel.querySelector("#gt-tax-law-tax");
    const number = panel.querySelector("#gt-tax-law-tax-number");
    const label = panel.querySelector("#gt-tax-law-tax-label");
    const apply = panel.querySelector("#gt-tax-law-apply-tax");

    function syncTax(value) {
      value = clamp(value, 0, 100);
      slider.value = value;
      number.value = value;
      label.textContent = value + "%";
    }

    slider.addEventListener("input", function () {
      syncTax(slider.value);
    });

    number.addEventListener("input", function () {
      syncTax(number.value);
    });

    apply.addEventListener("click", function () {
      const value = clamp(number.value, 0, 100);
      setTaxRate(town, value);
      syncTax(value);
      log(townName + ": tax rate set to " + value + "%.");
    });

    panel.querySelector("#gt-tax-law-add").addEventListener("click", function () {
      const input = panel.querySelector("#gt-tax-law-new-name");
      const state = panel.querySelector("#gt-tax-law-new-state").value;
      const rawName = String(input.value || "").trim();

      if (!rawName) return;

      const lawName = rawName
        .toLowerCase()
        .replace(/[^a-z0-9_ -]/g, "")
        .replace(/[ -]+/g, "_");

      setLawState(town, lawName, state);
      log(townName + ": " + titleCase(lawName) + " is now " + state + ".");

      input.value = "";
      renderPanel();
    });

    const parent = findBestInsertionParent();

    if (panel.parentElement !== parent) parent.appendChild(panel);
  }

  function boot() {
    renderPanel();

    setInterval(function () {
      renderPanel();
      applyDailyTaxes();
    }, 750);

    document.addEventListener(
      "click",
      function () {
        setTimeout(renderPanel, 100);
      },
      true
    );

    document.addEventListener(
      "keydown",
      function () {
        setTimeout(renderPanel, 100);
      },
      true
    );

    log("Tax and Law Control mod loaded.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
