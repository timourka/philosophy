function words(text) {
  return text.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [];
}

function fold(word) {
  return word.toLocaleLowerCase('ru').replaceAll('\u0451', '\u0435');
}

function sharedPrefix(spoken, written) {
  let count = 0;
  while (count < spoken.length && count < written.length && fold(spoken[count]) === fold(written[count])) {
    count += 1;
  }
  return count;
}

function openWord(text, cursor) {
  const before = text.slice(0, cursor);
  const match = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.exec(before);
  return match ? match[0] : '';
}

function overlap(spoken, written) {
  const limit = Math.min(spoken.length, written.length);
  let best = 0;
  for (let length = 1; length <= limit; length += 1) {
    const tail = written.slice(-length).map(fold).join(' ');
    const head = spoken.slice(0, length).map(fold).join(' ');
    if (tail === head) best = length;
  }
  return best;
}

export class NoteAssistant {
  #finals = [];
  #interim = [];
  #seenFinals = new Set();
  #consumed = 0;
  #corrections = [];

  setCorrections(pairs = []) {
    this.#corrections = pairs
      .map(({ from, to }) => ({ from: words(from).map(fold), to: words(to) }))
      .filter((pair) => pair.from.length > 0)
      .sort((left, right) => right.from.length - left.from.length);
  }

  #correct(phrase) {
    const result = [];
    for (let index = 0; index < phrase.length;) {
      const pair = this.#corrections.find((candidate) => candidate.from.every(
        (word, offset) => fold(phrase[index + offset] ?? '') === word,
      ));
      if (!pair) {
        result.push(phrase[index]);
        index += 1;
      } else {
        result.push(...pair.to);
        index += pair.from.length;
      }
    }
    return result;
  }

  updateHypothesis({ id, final, alternatives } = {}, contextText = '') {
    const written = words(contextText);
    const ranked = (alternatives ?? [])
      .map((alternative) => words(alternative.text ?? ''))
      .map((raw) => ({ raw, phrase: this.#correct(raw) }))
      .map((item) => ({ ...item, overlap: overlap(item.raw, written) }))
      .sort((left, right) => right.overlap - left.overlap || right.phrase.length - left.phrase.length);
    const phrase = ranked[0]?.phrase ?? [];
    const raw = ranked[0]?.raw ?? [];
    if (final) {
      const key = `${id}\0${phrase.map(fold).join(' ')}`;
      if (!this.#seenFinals.has(key)) {
        this.#seenFinals.add(key);
        this.#finals.push(phrase);
      }
      this.#interim = [];
    } else {
      this.#interim = phrase;
    }
    this.#consumed = Math.max(
      this.#consumed,
      overlap(this.#pending(), written),
      overlap(raw, written) > 0 ? this.#pending().length - phrase.length + overlap(raw, written) : 0,
    );
  }

  #pending() {
    return this.#finals.flat().concat(this.#interim);
  }

  suggest(text = '', cursor = text.length) {
    this.#consumed = Math.max(this.#consumed, overlap(this.#pending(), words(text.slice(0, cursor))));
    const word = this.#pending()[this.#consumed];
    if (!word) return null;
    const partial = openWord(text, cursor);
    if (partial && fold(word).startsWith(fold(partial)) && fold(word) !== fold(partial)) {
      return { insertion: word.slice(partial.length), display: word };
    }
    const before = text.slice(0, cursor);
    const insertion = before.length > 0 && !/\s$/.test(before) ? ` ${word}` : word;
    return { insertion, display: word };
  }

  accept(text = '', cursor = text.length) {
    const hint = this.suggest(text, cursor);
    if (!hint) return null;
    this.#consumed += 1;
    const next = text.slice(0, cursor) + hint.insertion + text.slice(cursor);
    return { text: next, cursor: cursor + hint.insertion.length };
  }

  dismiss() {
    this.#finals = [];
    this.#interim = [];
    this.#consumed = 0;
  }
}
