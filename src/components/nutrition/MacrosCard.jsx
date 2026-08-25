import { Info, AlertTriangle } from "lucide-react";
import { computeMacros, computeCalories, parseDecimal } from "../../lib/calculations.js";

function MacroBlock({ label, color, editable, editablePerKg, pct, onPct, perKg, onPerKg, grams, kcal, lockedNote }) {
  return (
    <div style={{ background: "var(--card2)", borderRadius: 8, padding: "12px 14px", borderTop: `2px solid ${color}` }}>
      <div style={{ fontSize: ".72rem", letterSpacing: ".06em", color, fontWeight: 600, marginBottom: 8, fontFamily: "var(--font-condensed)", textTransform: "uppercase" }}>
        {label}
      </div>
      {editable && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 6 }}>
          <input
            type="text" inputMode="decimal" value={pct} aria-label={`${label} em porcento`}
            onChange={(e) => onPct(e.target.value)}
            style={{ width: 64, fontSize: "1rem", padding: "5px 8px" }}
          />
          <span style={{ fontSize: ".82rem", color: "var(--t2)" }}>%</span>
        </div>
      )}
      {editablePerKg && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <input
              type="text" inputMode="decimal" value={perKg} aria-label={`${label} em gramas por kg`}
              onChange={(e) => onPerKg(e.target.value)}
              style={{ width: 64, fontSize: "1rem", padding: "5px 8px" }}
            />
            <span style={{ fontSize: ".82rem", color: "var(--t2)" }}>g/kg</span>
          </div>
          <div style={{ fontSize: ".68rem", color: "var(--t3)", marginTop: 3 }}>{pct}% das kcal</div>
        </div>
      )}
      {lockedNote && (
        <div style={{ marginBottom: 8 }}>
          <div className="num" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{pct}%</div>
          <div style={{ fontSize: ".68rem", color: "var(--t3)" }}>{lockedNote}</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderTop: "1px solid var(--bdr-soft)", paddingTop: 8 }}>
        <div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>
          {grams}<span style={{ fontSize: ".72rem", fontWeight: 400, color: "var(--t2)" }}> g</span>
        </div>
        <div className="num" style={{ marginLeft: "auto", fontSize: ".82rem", color: "var(--t2)" }}>{kcal} kcal</div>
      </div>
    </div>
  );
}

function MacroBar({ p, f, c }) {
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, background: "var(--card2)" }}>
      <div style={{ width: `${p}%`, background: "var(--good)" }} title={`proteína ${p}%`} />
      <div style={{ width: `${f}%`, background: "var(--warn)" }} title={`gordura ${f}%`} />
      <div style={{ width: `${c}%`, background: "var(--accent)" }} title={`carboidrato ${c}%`} />
    </div>
  );
}

export default function MacrosCard({ settings, onChange, currentWeight, hasWeights }) {
  const calories = computeCalories({
    hasWeights, currentWeight,
    height: settings.height_cm, age: settings.age, sex: settings.sex,
    trainDays: settings.train_days, deficitPct: settings.deficit_pct,
  });
  const macros = computeMacros({
    hasWeights,
    kcal: calories.target,
    currentWeight,
    protPct: settings.macro_prot_pct,
    fatPct: settings.macro_fat_pct,
    protPerKg: settings.macro_prot_per_kg,
    fatPerKg: settings.macro_fat_per_kg,
  });
  const mode = settings.macro_mode;

  function numChange(field) {
    return (raw) => {
      const v = parseDecimal(raw);
      onChange({ [field]: isNaN(v) ? 0 : Math.max(0, v) });
    };
  }

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div className="card-label" style={{ marginBottom: 0 }}>
          Macronutrientes{macros ? ` · ${macros.kcal} kcal` : ""}
        </div>
        <div className="flex-row" style={{ gap: 4 }}>
          <button type="button" className={"toggle-pill" + (mode === "pct" ? " active" : "")} onClick={() => onChange({ macro_mode: "pct" })}>Por %</button>
          <button type="button" className={"toggle-pill" + (mode === "weight" ? " active" : "")} onClick={() => onChange({ macro_mode: "weight" })}>Por peso</button>
        </div>
      </div>

      {!macros ? (
        <p style={{ fontSize: ".85rem", color: "var(--t3)", lineHeight: 1.5 }}>
          Registre uma pesagem para distribuir os macros sobre a caloria alvo.
        </p>
      ) : mode === "pct" ? (
        <>
          <div className="grid-auto">
            <MacroBlock
              label="Proteína" color="var(--good)" editable
              pct={macros.byPct.prot.pct} onPct={numChange("macro_prot_pct")}
              grams={macros.byPct.prot.g} kcal={macros.byPct.prot.kcal}
            />
            <MacroBlock
              label="Carboidrato" color="var(--accent)"
              pct={macros.byPct.carb.pct} lockedNote="resto automático"
              grams={macros.byPct.carb.g} kcal={macros.byPct.carb.kcal}
            />
            <MacroBlock
              label="Gordura" color="var(--warn)" editable
              pct={macros.byPct.fat.pct} onPct={numChange("macro_fat_pct")}
              grams={macros.byPct.fat.g} kcal={macros.byPct.fat.kcal}
            />
          </div>
          <MacroBar p={macros.byPct.prot.pct} f={macros.byPct.fat.pct} c={macros.byPct.carb.pct} />
          <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Você ajusta proteína e gordura; o carboidrato preenche o resto para fechar 100%. Proteína e carbo = 4 kcal/g, gordura = 9 kcal/g.</span>
          </div>
        </>
      ) : (
        <>
          <div className="grid-auto">
            <MacroBlock
              label="Proteína" color="var(--good)" editablePerKg
              perKg={macros.byWeight.prot.perKg} onPerKg={numChange("macro_prot_per_kg")}
              grams={macros.byWeight.prot.g} kcal={macros.byWeight.prot.kcal} pct={macros.byWeight.prot.pct}
            />
            <MacroBlock
              label="Carboidrato" color="var(--accent)" lockedNote="resto das kcal"
              grams={macros.byWeight.carb.g} kcal={macros.byWeight.carb.kcal} pct={macros.byWeight.carb.pct}
            />
            <MacroBlock
              label="Gordura" color="var(--warn)" editablePerKg
              perKg={macros.byWeight.fat.perKg} onPerKg={numChange("macro_fat_per_kg")}
              grams={macros.byWeight.fat.g} kcal={macros.byWeight.fat.kcal} pct={macros.byWeight.fat.pct}
            />
          </div>
          <MacroBar p={macros.byWeight.prot.pct} f={macros.byWeight.fat.pct} c={macros.byWeight.carb.pct} />
          {macros.byWeight.overflow && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: ".76rem", color: "var(--accent)", lineHeight: 1.45 }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Proteína + gordura já ultrapassam a caloria alvo. Reduza g/kg ou o carboidrato fica zerado.</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 10, fontSize: ".76rem", color: "var(--t3)", lineHeight: 1.45 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Proteína e gordura ancoradas no seu peso ({currentWeight}kg); o carboidrato leva as calorias que sobram. Para recomposição: proteína ~1,8–2,2 g/kg, gordura ~0,8–1 g/kg.</span>
          </div>
        </>
      )}
    </div>
  );
}
