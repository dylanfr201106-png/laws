/*
    town[key] = clamp(town[key] + amount, min, max);
    return true;
  }

  function applyMoodAndLawEffects(town) {
    if (!town) return;

    const taxRate = Number(town.modTaxRate || 0);
    if (taxRate > 0) {
      // Low taxes are mostly accepted. Very high taxes hurt mood and raise unrest.
      if (taxRate <= 15) addToTownStat(town, ["mood", "happiness", "morale"], 0.005, 0, 100);
      if (taxRate > 35) addToTownStat(town, ["mood", "happiness", "morale"], -0.015 * (taxRate / 35), 0, 100);
      if (taxRate > 55) addToTownStat(town, ["revolt", "revoltChance", "unrest", "rebellion"], 0.01 * (taxRate / 55), 0, 100);
    }

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
