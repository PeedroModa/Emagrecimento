// "O que estou descobrindo": o motor ainda calibrando, com o quanto falta em
// termos legíveis. Existe para que o app NUNCA fique numa tela vazia por
// falta de dado — mesmo sem nenhuma descoberta nova, sempre há uma barra que
// andou. Cada item só aparece enquanto a investigação correspondente ainda
// não desbloqueou (ver requires() das regras em rules/tier1.js e tier2.js).
export function computeInvestigations(ctx) {
  const items = [];

  if (ctx.denseDeltaCount < 10) {
    items.push({
      id: "personal-noise-band",
      titulo: "Sua faixa de oscilação pessoal",
      descricao: "Quando eu souber quanto seu corpo varia sozinho, consigo dizer se cada mudança é real ou é água.",
      atual: ctx.denseDeltaCount,
      meta: 10,
      unidade: "pesagens densas analisadas",
    });
  }

  const t28 = ctx.trends[28];
  const n28 = t28 ? t28.n : ctx.n;
  if (n28 < 14) {
    items.push({
      id: "trend-significance",
      titulo: "Se seu ritmo atual é estatisticamente real",
      descricao: "Com pesagens suficientes numa janela de 4 semanas, consigo separar tendência real de oscilação.",
      atual: n28,
      meta: 14,
      unidade: "pesagens em 28 dias",
    });
  }

  const t90 = ctx.trends[90];
  const n90 = t90 ? t90.n : ctx.n;
  if (n90 < 28) {
    items.push({
      id: "weekday-effect",
      titulo: "Efeito do dia da semana",
      descricao: "Com pesagens quase diárias por várias semanas, consigo dizer se algum dia costuma pesar diferente do resto.",
      atual: n90,
      meta: 28,
      unidade: "pesagens em 90 dias",
    });
  }

  return items;
}
