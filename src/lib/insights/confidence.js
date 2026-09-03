// Deriva o selo de confiança a partir de estatística crua — nunca escrito
// à mão dentro de uma regra. `kind` diz que TIPO de alegação está sendo
// feita; o resto são os números que sustentam (ou não) subir de selo.
//
// fato        — leitura direta dos dados (kind: "fact")
// tendencia   — regressão cujo IC 95% exclui zero, com amostra >= 14 e
//               sem ser um teste escolhido a posteriori (postHoc)
// estimativa  — extrapolação sob premissa explícita (kind: "estimate"),
//               ou um teste significativo mas com amostra pequena/IC largo
// hipotese    — associação, teste exploratório (postHoc), ou p acima de 0.05
export function confidenceFrom({ kind, n = 0, pAdj = null, postHoc = false }) {
  if (kind === "fact") return "fato";
  if (kind === "estimate") return "estimativa";
  if (postHoc) return "hipotese";
  if (pAdj == null) return "hipotese";
  if (pAdj < 0.05 && n >= 14) return "tendencia";
  if (pAdj < 0.05) return "estimativa";
  return "hipotese";
}
