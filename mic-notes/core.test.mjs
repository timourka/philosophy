import { test } from 'node:test';
import assert from 'node:assert/strict';
test('typing after a hypothesis advances the hint without accepting', () => {
 const n=new NoteAssistant();n.updateHypothesis({id:'x',final:true,alternatives:[{text:'Наука есть знание'}]},'');
 assert.equal(n.suggest('Наука',5).display,'есть');
});
test('a new final does not rewind words already accepted', () => {
 const n=new NoteAssistant();n.updateHypothesis({id:'a',final:true,alternatives:[{text:'Наука есть'}]},'');
 n.accept('',0);n.accept('Наука',5);
 n.updateHypothesis({id:'b',final:true,alternatives:[{text:'знание'}]},'Наука есть');
 assert.equal(n.suggest('Наука есть',10).display,'знание');
});
test('context matching uses note tail rather than start', () => {
 const n=new NoteAssistant();n.updateHypothesis({id:'a',final:true,alternatives:[{text:'Наука есть знание'}]},'Лекция. Наука есть');
 assert.equal(n.suggest('Лекция. Наука есть',17).display,'знание');
});

import { NoteAssistant } from './core.mjs';

test('Tab accepts nothing until a speech hypothesis arrives', () => {
  const notes = new NoteAssistant();
  assert.equal(notes.suggest('\u043d\u0430\u0443\u043a\u0430', 5), null);
  assert.equal(notes.accept('\u043d\u0430\u0443\u043a\u0430', 5), null);
});

test('a final hypothesis offers its first word when the note is empty', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.suggest('', 0), {
    insertion: '\u043d\u0430\u0443\u043a\u0430',
    display: '\u043d\u0430\u0443\u043a\u0430',
  });
});

test('accept inserts exactly one word and advances the queue', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.accept('', 0), { text: '\u043d\u0430\u0443\u043a\u0430', cursor: 5 });
  assert.deepEqual(notes.suggest('\u043d\u0430\u0443\u043a\u0430', 5), {
    insertion: ' \u0435\u0441\u0442\u044c',
    display: '\u0435\u0441\u0442\u044c',
  });
});

test('words already written are not offered again', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '\u041d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c');
  assert.deepEqual(notes.suggest('\u041d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', 12), {
    insertion: ' \u0437\u043d\u0430\u043d\u0438\u0435',
    display: '\u0437\u043d\u0430\u043d\u0438\u0435',
  });
});

test('a partially typed word is completed rather than repeated', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '\u043d\u0430\u0443');
  assert.deepEqual(notes.suggest('\u043d\u0430\u0443', 3), { insertion: '\u043a\u0430', display: '\u043d\u0430\u0443\u043a\u0430' });
  assert.deepEqual(notes.accept('\u043d\u0430\u0443', 3), { text: '\u043d\u0430\u0443\u043a\u0430', cursor: 5 });
});

test('punctuation, yo and case do not restart an already written phrase', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u0415\u0451, \u043d\u0430\u0443\u043a\u0430 \u2014 \u0437\u043d\u0430\u043d\u0438\u0435!' }],
  }, '\u0435\u0435 \u041d\u0430\u0443\u043a\u0430');
  assert.deepEqual(notes.suggest('\u0435\u0435 \u041d\u0430\u0443\u043a\u0430', 9), {
    insertion: ' \u0437\u043d\u0430\u043d\u0438\u0435',
    display: '\u0437\u043d\u0430\u043d\u0438\u0435',
  });
});

test('empty speech offers nothing and does not change the note', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({ id: '1:0', final: true, alternatives: [{ text: '...' }] }, '');
  notes.updateHypothesis({ id: '1:1', final: false, alternatives: [{ text: '' }] }, '');
  assert.equal(notes.suggest('', 0), null);
  assert.equal(notes.accept('', 0), null);
});

test('the same final phrase is not queued twice', () => {
  const notes = new NoteAssistant();
  const hypothesis = {
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c' }],
  };
  notes.updateHypothesis(hypothesis, '');
  notes.updateHypothesis(hypothesis, '');
  assert.deepEqual(notes.accept('', 0), { text: '\u043d\u0430\u0443\u043a\u0430', cursor: 5 });
  assert.deepEqual(notes.accept('\u043d\u0430\u0443\u043a\u0430', 5), { text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', cursor: 10 });
  assert.equal(notes.suggest('\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', 10), null);
});

test('a newer interim hypothesis replaces the previous one', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: false,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441' }],
  }, '');
  notes.updateHypothesis({
    id: '1:0',
    final: false,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c' }],
  }, '');
  assert.deepEqual(notes.accept('', 0), { text: '\u043d\u0430\u0443\u043a\u0430', cursor: 5 });
  assert.deepEqual(notes.accept('\u043d\u0430\u0443\u043a\u0430', 5), { text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', cursor: 10 });
  assert.equal(notes.suggest('\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', 10), null);
});

test('a later final phrase is appended instead of repeating the first', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430' }],
  }, '');
  notes.updateHypothesis({
    id: '1:1',
    final: true,
    alternatives: [{ text: '\u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.accept('', 0), { text: '\u043d\u0430\u0443\u043a\u0430', cursor: 5 });
  assert.deepEqual(notes.suggest('\u043d\u0430\u0443\u043a\u0430', 5), {
    insertion: ' \u0435\u0441\u0442\u044c',
    display: '\u0435\u0441\u0442\u044c',
  });
});

test('an explicit correction replaces a recognized word before it is offered', () => {
  const notes = new NoteAssistant();
  notes.setCorrections([{ from: '\u043d\u0430\u0443\u043a\u0430', to: '\u044d\u043f\u0438\u0441\u0442\u0435\u043c\u0430' }]);
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.suggest('', 0), { insertion: '\u044d\u043f\u0438\u0441\u0442\u0435\u043c\u0430', display: '\u044d\u043f\u0438\u0441\u0442\u0435\u043c\u0430' });
});

test('a paraphrase that differs from speech is not treated as a correction', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '\u043f\u043e\u0437\u043d\u0430\u043d\u0438\u0435 \u043d\u0430\u0434\u0451\u0436\u043d\u043e');
  assert.deepEqual(notes.suggest('\u043f\u043e\u0437\u043d\u0430\u043d\u0438\u0435 \u043d\u0430\u0434\u0451\u0436\u043d\u043e', 18), {
    insertion: ' \u043d\u0430\u0443\u043a\u0430',
    display: '\u043d\u0430\u0443\u043a\u0430',
  });
});

test('the alternative that continues the note tail is preferred', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [
      { text: '\u043d\u0430 \u0443\u043a\u0430 \u0435\u0441\u0442\u044c', confidence: 0.9 },
      { text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435', confidence: 0.4 },
    ],
  }, '\u041d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c');
  assert.deepEqual(notes.suggest('\u041d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', 12), {
    insertion: ' \u0437\u043d\u0430\u043d\u0438\u0435',
    display: '\u0437\u043d\u0430\u043d\u0438\u0435',
  });
});

test('accept inserts one word at a cursor in the middle and leaves the rest', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '\u043d\u0430\u0443\u043a\u0430');
  assert.deepEqual(notes.accept('\u043d\u0430\u0443\u043a\u0430. \u041a\u043e\u043d\u0435\u0446', 5), {
    text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c. \u041a\u043e\u043d\u0435\u0446',
    cursor: 10,
  });
});

test('dismiss drops the current hint without changing the note', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  notes.dismiss();
  assert.equal(notes.suggest('', 0), null);
  assert.equal(notes.accept('', 0), null);
  notes.updateHypothesis({
    id: '1:1',
    final: true,
    alternatives: [{ text: '\u043e\u043f\u044b\u0442' }],
  }, '');
  assert.deepEqual(notes.suggest('', 0), { insertion: '\u043e\u043f\u044b\u0442', display: '\u043e\u043f\u044b\u0442' });
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.suggest('', 0), { insertion: '\u043e\u043f\u044b\u0442', display: '\u043e\u043f\u044b\u0442' });
});

test('hyphenated terms and yo match corrections regardless of case', () => {
  const notes = new NoteAssistant();
  notes.setCorrections([{ from: '\u0412 \u0441\u0435\u0431\u0435', to: '\u0432-\u0441\u0435\u0431\u0435' }]);
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u0432 \u0441\u0451\u0431\u0435 \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.accept('', 0), { text: '\u0432-\u0441\u0435\u0431\u0435', cursor: 6 });
  assert.deepEqual(notes.suggest('\u0432-\u0441\u0435\u0431\u0435', 6), { insertion: ' \u0437\u043d\u0430\u043d\u0438\u0435', display: '\u0437\u043d\u0430\u043d\u0438\u0435' });
});

test('corrections never rewrite text the user already typed', () => {
  const notes = new NoteAssistant();
  notes.setCorrections([{ from: '\u043d\u0430\u0443\u043a\u0430', to: '\u044d\u043f\u0438\u0441\u0442\u0435\u043c\u0430' }]);
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c' }],
  }, '\u043d\u0430\u0443\u043a\u0430');
  assert.deepEqual(notes.suggest('\u043d\u0430\u0443\u043a\u0430', 5), { insertion: ' \u0435\u0441\u0442\u044c', display: '\u0435\u0441\u0442\u044c' });
});

test('recent note terms outrank a higher-confidence alternative', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [
      { text: '\u043f\u043b\u0430\u0442\u043e\u043d \u0433\u043e\u0432\u043e\u0440\u0438\u043b', confidence: 0.95 },
      { text: '\u041f\u043b\u0430\u0442\u043e\u043d \u0433\u043e\u0432\u043e\u0440\u0438\u043b \u043e \u0431\u043b\u0430\u0433\u0435', confidence: 0.2 },
    ],
  }, '\u041f\u043b\u0430\u0442\u043e\u043d \u0433\u043e\u0432\u043e\u0440\u0438\u043b');
  assert.deepEqual(notes.suggest('\u041f\u043b\u0430\u0442\u043e\u043d \u0433\u043e\u0432\u043e\u0440\u0438\u043b', 15), {
    insertion: ' \u043e',
    display: '\u043e',
  });
});

test('a partial word matches yo and case before completing it', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: false,
    alternatives: [{ text: '\u0415\u0451 \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '');
  assert.deepEqual(notes.suggest('\u0435', 1), { insertion: '\u0451', display: '\u0415\u0451' });
});

test('a cursor inside an earlier word does not rewrite the surrounding note', () => {
  const notes = new NoteAssistant();
  notes.updateHypothesis({
    id: '1:0',
    final: true,
    alternatives: [{ text: '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c \u0437\u043d\u0430\u043d\u0438\u0435' }],
  }, '\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c');
  assert.deepEqual(notes.accept('\u043d\u0430\u0443\u043a\u0430 \u0435\u0441\u0442\u044c', 3), {
    text: '\u043d\u0430\u0443 \u0437\u043d\u0430\u043d\u0438\u0435\u043a\u0430 \u0435\u0441\u0442\u044c',
    cursor: 10,
  });
});
