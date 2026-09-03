// Hash estável e curto (FNV-1a) dos números materiais de um insight — usado
// como payloadHash para o feed saber se "a mesma descoberta" mudou de
// conteúdo (e por isso merece voltar a aparecer como nova) ou é idêntica ao
// que o usuário já viu/dispensou.
export function payloadHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
