/**
 * Conta palavras válidas separadas por qualquer whitespace.
 * Pontuação anexa não conta como palavra separada.
 * Ex.: countWords("olá, mundo!") === 2
 */
export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}
