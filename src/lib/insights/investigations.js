// "O que estou descobrindo": o motor ainda calibrando, com o quanto falta em
// termos legíveis. Existe para que o app NUNCA fique numa tela vazia por
// falta de dado — mesmo sem nenhuma descoberta nova, sempre há uma barra que
// andou. Cobre TODAS as regras travadas por volume de dado (não as que
// dependem de um evento, como bater recorde ou cruzar um marco de data):
// antes listava três e escondia as outras oito, e o usuário lia o silêncio
// do feed como "o app não tem nada a dizer" em vez de "faltam duas pesagens".
// Ordenado pelo que está mais perto de destravar.
import { daysBetween } from "../calculations.js";

const MARKER_KEYS = ["trained", "alcohol", "high_sodium", "travel", "slept_badly"];

export function computeInvestigations(ctx) {
  const items = [];
  const push = (id, titulo, descricao, atual, meta, unidade) => items.push({ id, titulo, descricao, atual, meta, unidade });

  if (ctx.denseDeltaCount < 10) {
    push("personal-noise-band", "Sua faixa de oscilação pessoal",
      "Quando eu souber quanto seu corpo varia sozinho, consigo dizer se cada mudança é real ou é água.",
      ctx.denseDeltaCount, 10, "pesagens densas analisadas");
  }

  const t28 = ctx.trends[28];
  const n28 = t28 ? t28.n : ctx.n;
  if (n28 < 14) {
    push("trend-significance", "Se seu ritmo atual é estatisticamente real",
      "Com pesagens suficientes numa janela de 4 semanas, consigo separar tendência real de oscilação.",
      n28, 14, "pesagens em 28 dias");
  }

  // Linha de verdade de 7 dias: só existe em regime denso (≥5 pesagens nos
  // últimos 7 dias). Mede a partir da última pesagem, não de hoje.
  if (ctx.lastSeries && ctx.lastSeries.avgWindowDays !== 7 && ctx.last) {
    const inWeek = ctx.sorted.filter((w) => daysBetween(w.date, ctx.last.date) < 7).length;
    push("true-trend-line", "Uma linha de verdade de 7 dias",
      "Com pesagem quase diária, a média da semana vira o número que vale acompanhar, no lugar da balança do dia.",
      Math.min(inWeek, 5), 5, "pesagens nos últimos 7 dias");
  }

  // Mudança de ritmo: 8 pesagens nas últimas 4 semanas + 4 nas 4 anteriores.
  if (ctx.points.length) {
    const endT = ctx.points[ctx.points.length - 1].t;
    const recent = ctx.points.filter((p) => p.t > endT - 28).length;
    const previous = ctx.points.filter((p) => p.t <= endT - 28 && p.t > endT - 56).length;
    if (recent < 8) {
      push("pace-change", "Se o seu ritmo mudou",
        "Comparo as últimas 4 semanas com as 4 anteriores para dizer se você desacelerou, parou ou voltou a cair.",
        recent, 8, "pesagens nas últimas 4 semanas");
    } else if (previous < 4) {
      push("pace-change", "Se o seu ritmo mudou",
        "Já tenho as últimas 4 semanas; falta base nas 4 semanas anteriores para comparar.",
        previous, 4, "pesagens nas 4 semanas anteriores");
    }
  }

  const t90 = ctx.trends[90];
  const n90 = t90 ? t90.n : ctx.n;
  if (n90 < 28) {
    push("weekday-effect", "Efeito do dia da semana",
      "Com pesagens quase diárias por várias semanas, consigo dizer se algum dia costuma pesar diferente do resto.",
      n90, 28, "pesagens em 90 dias");
  }

  if (ctx.n < 30) {
    push("journey-phases", "As fases da sua jornada",
      "Com histórico suficiente, um teste de quebra encontra o ponto em que seu ritmo mudou de regime.",
      ctx.n, 30, "pesagens");
  } else if (ctx.journeyDays < 60) {
    push("journey-phases", "As fases da sua jornada",
      "Já tenho pesagens; falta tempo de jornada para uma quebra fazer sentido.",
      ctx.journeyDays, 60, "dias de jornada");
  }

  if (ctx.journeyDays < 100) {
    push("milestone-90d", "Você hoje contra você há 90 dias",
      "A partir de 100 dias de jornada, comparo seu peso de hoje com o de três meses atrás — sem estatística, só dois pontos reais.",
      ctx.journeyDays, 100, "dias de jornada");
  }

  // Efeito de marcadores (treino, álcool...) e de hidratação: ambos precisam
  // de 20 pesagens em 90 dias, e cada um do seu próprio dado de contexto.
  const pts90 = t90 ? t90.points.length : 0;
  const markedMax = Math.max(0, ...MARKER_KEYS.map((k) => ctx.markers.filter((m) => m[k] === true).length));
  if (pts90 < 20) {
    push("marker-effect", "Se treino, álcool ou sono ruim mexem na balança",
      "Comparo o peso nos dias marcados com os dias sem marcação, com defasagem de até 2 dias.",
      pts90, 20, "pesagens em 90 dias");
  } else if (markedMax < 8) {
    push("marker-effect", "Se treino, álcool ou sono ruim mexem na balança",
      "Já tenho pesagens; falta um mesmo marcador aparecer em dias suficientes para comparar.",
      markedMax, 8, "dias com o mesmo marcador");
  }

  const hyd = ctx.hydration || [];
  if (hyd.length < 10) {
    push("hydration-effect", "Se a água do dia mexe na balança",
      "Comparo dias abaixo de 50% da meta de água com dias acima de 75%, no mesmo dia e no seguinte.",
      hyd.length, 10, "dias com água registrada");
  } else if (pts90 < 20) {
    push("hydration-effect", "Se a água do dia mexe na balança",
      "Já tenho água registrada; faltam pesagens na janela de 90 dias para comparar.",
      pts90, 20, "pesagens em 90 dias");
  }

  const withWaist = ctx.measurements.filter((m) => m.waist != null).length;
  if (withWaist < 1) {
    push("waist-height-ratio", "Sua razão cintura/altura",
      "Uma sessão de medidas com cintura basta — é o indicador de risco metabólico que o IMC não enxerga.",
      0, 1, "sessão de medidas com cintura");
  }
  if (ctx.measurements.length < 2) {
    push("recomposition", "Se a cintura cai mesmo com a balança parada",
      "Duas sessões de medidas mostram recomposição: gordura saindo enquanto o peso não muda.",
      ctx.measurements.length, 2, "sessões de medidas");
  }

  // Mais perto de destravar primeiro; empate mantém a ordem de definição.
  return items
    .map((it, idx) => ({ it, idx, frac: it.meta ? it.atual / it.meta : 0 }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx)
    .map(({ it }) => it);
}
