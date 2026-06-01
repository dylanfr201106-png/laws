 */ 
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
    console.log(`[${MOD_ID}] ${msg}`);
  }

  function clamp(num, min, max) {
    num = Number(num);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
  }

  function titleCase(str) {
    return String(str || "")
      .replace(/[_-]+/g, " ")
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  function getAllTowns() {
    try {
      if (typeof regFilter === "function") {
        const towns = regFilter("town", () => true);
        if (Array.isArray(towns)) return towns;
      }
    } catch (e) {}
    try { if (Array.isArray(window.towns)) return window.towns; } catch (e) {}
    try { if (window.regs && Array.isArray(window.regs.town)) return window.regs.town; } catch (e) {}
    try { if (window.planet && Array.isArray(window.planet.towns)) return window.planet.towns; } catch (e) {}
    return [];
  }

    }
    const panelText = document.body ? document.body.innerText : "";
    if (panelText) {
      const visible = towns.find(t => t && t.name && panelText.includes(t.name));
      if (visible) return visible;
    }

    return null;
  }

  function getTaxRate(town) {
    if (!town) return 0;
    const paths = [
      ["taxRate"], ["tax"], ["taxes"], ["incomeTax"], ["propertyTax"],
      ["economy", "taxRate"], ["economy", "tax"],
      ["currency", "taxRate"], ["government", "taxRate"],
      ["modTaxRate"],
    ];
    for (const path of paths) {
      let obj = town;
      for (const key of path) obj = obj && obj[key];
      if (typeof obj === "number") return obj <= 1 ? Math.round(obj * 100) : Math.round(obj);
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

  try { window.dispatchEvent(new CustomEvent("gentown:taxChanged", { detail: { town, percent } })); } catch (e) {}
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
    const names = new Set([...Object.keys(vanilla), ...Object.keys(overrides)]);
    return [...names].sort();
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
      town.laws = { [lawName]: legal };
    }

    try { window.dispatchEvent(new CustomEvent("gentown:lawChanged", { detail: { town, lawName, legal } })); } catch (e) {}
  }
let lastDaySeen = null;

  const LAW_EFFECTS = {
    slavery: { mood: -0.08, revolt: 0.04, wealth: 0.04 },
    forced_labor: { mood: -0.07, revolt: 0.035, wealth: 0.03 },
    free_speech: { mood: 0.04, revolt: -0.02 },
    censorship: { mood: -0.04, revolt: 0.025 },
    weapons: { mood: -0.01, revolt: 0.015, crime: 0.025 },
    alcohol: { mood: 0.02, crime: 0.015 },
    religion: { mood: 0.015, revolt: -0.01 },
    immigration: { mood: -0.005, wealth: 0.015, growth: 0.02 },
    healthcare: { mood: 0.04, growth: 0.015, wealth: -0.01 },
    education: { mood: 0.025, wealth: 0.02 },
    police: { mood: -0.015, revolt: -0.025, crime: -0.04 },
    unions: { mood: 0.025, wealth: -0.015, revolt: -0.01 },
    gambling: { mood: 0.015, crime: 0.02, wealth: 0.01 },
    drugs: { mood: -0.015, crime: 0.04, wealth: 0.015 },
    private_property: { mood: 0.01, wealth: 0.025 },
    monarchy: { mood: -0.02, revolt: 0.02 },
    dictatorship: { mood: -0.06, revolt: 0.05, crime: -0.01 },
    democracy: { mood: 0.045, revolt: -0.025 },
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

    const overrides = ensureLawOverrides(town);
    for (const [lawName, isLegal] of Object.entries(overrides)) {
      const effect = LAW_EFFECTS[lawName];
      if (!effect) continue;

      // If the law is illegal, reverse most effects. Example: slavery illegal improves mood instead of lowering it.
      const dir = isLegal ? 1 : -1;

      if (effect.mood) addToTownStat(town, ["mood", "happiness", "morale"], effect.mood * dir, 0, 100);
      if (effect.revolt) addToTownStat(town, ["revolt", "revoltChance", "unrest", "rebellion"], effect.revolt * dir, 0, 100);
      if (effect.crime) addToTownStat(town, ["crime", "crimeRate"], effect.crime * dir, 0, 100);
      if (effect.growth) addToTownStat(town, ["growth", "growthRate", "popGrowth"], effect.growth * dir, -100, 100);

      if (effect.wealth) {
        const wealthKey = getStatKey(town, ["privateWealth", "wealth"]);
        if (wealthKey) town[wealthKey] = Math.max(0, town[wealthKey] * (1 + effect.wealth * dir * 0.002));
      }
    }
  }

  function applyDailyTaxes() {
    let day = null;
    try { day = window.day ?? window.days ?? window.currentDay ?? (window.planet && window.planet.day); } catch (e) {}
    if (day === null || day === undefined || day === lastDaySeen) return;
    lastDaySeen = day;

    for (const town of getAllTowns()) {
      const rate = Number(town.modTaxRate || 0);
      if (rate) {
        const wealthKey = typeof town.privateWealth === "number" ? "privateWealth" : null;
        const treasuryKey = typeof town.cash === "number" ? "cash" : (typeof town.money === "number" ? "money" : null);
        const pop = Number(town.pop || town.population || 0);

        if (wealthKey && treasuryKey) {
          const base = Math.max(0, town[wealthKey]);
          const collected = Math.floor(base * (rate / 100) / 365);
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

  function boot() {
    renderPanel();
    setInterval(() => {
      renderPanel();
      applyDailyTaxes();
    }, 750);

    document.addEventListener("click", () => setTimeout(renderPanel, 100), true);
    document.addEventListener("keydown", () => setTimeout(renderPanel, 100), true);
    log("Tax + Law Control mod loaded. Open a town to edit taxes and laws.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
