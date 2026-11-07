import {NoteAssistant} from './core.mjs';
import {SpeechAdapter} from './speech.mjs';
const $=s=>document.querySelector(s),editor=$('#editor'),title=$('#title');
const KEY='philosophy-mic-notes-v1';
let saved={},corrections=[],demoId=0,isComposing=false;
try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
editor.value=typeof saved.text==='string'?saved.text:'';title.value=typeof saved.title==='string'?saved.title:'';
corrections=Array.isArray(saved.corrections)?saved.corrections.filter(x=>typeof x.from==='string'&&typeof x.to==='string'):[];
const assistant=new NoteAssistant();assistant.setCorrections(corrections);
const Recognition=window.isSecureContext?(window.SpeechRecognition||window.webkitSpeechRecognition):null;
let currentSuggestion=null;
function persist(){try{localStorage.setItem(KEY,JSON.stringify({text:editor.value,title:title.value,corrections}));$('#saveState').textContent='Сохранено в браузере'}catch{$('#saveState').textContent='Не удалось сохранить — скачайте .md'}}
function refresh(){
 currentSuggestion=editor.selectionStart===editor.selectionEnd&&!isComposing?assistant.suggest(editor.value,editor.selectionStart):null;
 $('#suggestion').textContent=currentSuggestion?.display||'Пока нет подсказки';$('#accept').disabled=!currentSuggestion;
 $('#mirrorText').textContent=editor.value.slice(0,editor.selectionStart);
 $('#ghostText').textContent=currentSuggestion?.insertion||'';
 $('#ghost').scrollTop=editor.scrollTop;$('#ghost').scrollLeft=editor.scrollLeft;
 $('#words').textContent=(editor.value.match(/[\p{L}\p{N}]+/gu)||[]).length+' слов';
}
function insertSuggestion(){
 if(!currentSuggestion||isComposing)return;
 const result=assistant.accept(editor.value,editor.selectionStart);if(!result)return;
 const before=editor.value, cursor=editor.selectionStart;
 editor.focus();
 // Insert only the changed range through the native edit command to retain undo.
 let prefix=0;while(prefix<before.length&&prefix<result.text.length&&before[prefix]===result.text[prefix])prefix++;
 let suffix=0;while(suffix<before.length-prefix&&suffix<result.text.length-prefix&&before[before.length-1-suffix]===result.text[result.text.length-1-suffix])suffix++;
 editor.setSelectionRange(prefix,before.length-suffix);
 const insertion=result.text.slice(prefix,result.text.length-suffix);
 const native=document.execCommand('insertText',false,insertion);
 if(!native){editor.setRangeText(insertion,prefix,before.length-suffix,'end');}
 editor.setSelectionRange(result.cursor,result.cursor);persist();refresh();
}
const messages={
 'not-allowed':'Доступ к микрофону запрещён. Проверьте разрешение сайта в браузере.',
 'service-not-allowed':'Сервис распознавания недоступен в этом браузере.',
 'audio-capture':'Микрофон не найден или занят другим приложением.',
 'network':'Нет соединения с сервисом распознавания. Набранный текст сохранён.',
 'no-speech':'Речь не обнаружена. Можно начать прослушивание снова.',
 'language-not-supported':'Русский язык не поддерживается выбранным сервисом.',
 'phrases-not-supported':'Браузер не поддерживает контекстные термины.',
 'aborted':'Прослушивание остановлено.'
};
const adapter=new SpeechAdapter({Recognition,onHypothesis:h=>{
 assistant.updateHypothesis(h,editor.value.slice(0,editor.selectionStart));
 $('#transcript').textContent=h.alternatives[0]?.text||'';
 $('#hypothesisState').textContent=h.final?'Окончательная гипотеза':'Предварительная гипотеза · может измениться';refresh();
},onStatus:(status,error)=>{
 const active=status==='listening'||status==='starting';$('#micState').dataset.active=active;
 $('#micState span').textContent=status==='listening'?'Микрофон слушает':status==='starting'?'Запрашиваем микрофон…':status==='error'?'Ошибка распознавания':'Микрофон выключен';
 $('#start').disabled=active||!Recognition;$('#stop').disabled=!active;
 if(status==='error')$('#error').textContent=messages[error]||'Ошибка: '+error;
}});
$('#asrInfo').textContent=Recognition?'ru-RU · браузерный сервис. Может потребоваться интернет. После остановки сервиса нажмите «Начать» снова.':'В этом браузере нет SpeechRecognition. Откройте актуальный Chrome или Edge. Редактор и тестовый ввод доступны.';
$('#start').disabled=!Recognition;
$('#start').addEventListener('click',()=>{
 if(!$('#consent').checked){$('#error').textContent='Сначала подтвердите использование браузерного сервиса распознавания.';return;}
 $('#error').textContent='';try{adapter.start();updateBias()}catch(e){$('#error').textContent=e.message}
});
$('#stop').addEventListener('click',()=>adapter.stop());
window.addEventListener('pagehide',()=>{adapter.stop();persist()});
function updateBias(){
 const r=adapter.recognition;
 if(!r||!('phrases' in r)||!window.SpeechRecognitionPhrase){$('#biasInfo').textContent='Словарь применяется локально к гипотезам. Передача терминов в ASR этим браузером не поддерживается.';return;}
 try{const recent=editor.value.match(/[\p{L}][\p{L}-]{4,}/gu)||[];const terms=[...new Set([...corrections.map(x=>x.to),...recent.slice(-25)])].slice(0,40);r.phrases=terms.map(t=>new window.SpeechRecognitionPhrase(t,3));$('#biasInfo').textContent='Термины переданы в ASR как контекстные подсказки. Это не обучение модели.';}catch{$('#biasInfo').textContent='Контекст ASR не принят. Локальный словарь работает.';}
}
let biasTimer;
editor.addEventListener('input',()=>{persist();refresh();clearTimeout(biasTimer);biasTimer=setTimeout(updateBias,700)});
for(const event of ['click','keyup','select','scroll'])editor.addEventListener(event,refresh);
editor.addEventListener('compositionstart',()=>{isComposing=true;refresh()});editor.addEventListener('compositionend',()=>{isComposing=false;refresh()});
editor.addEventListener('keydown',e=>{
 if(e.key==='Tab'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&currentSuggestion&&!isComposing){e.preventDefault();insertSuggestion()}
 if(e.key==='Escape'){assistant.dismiss();refresh()}
});
$('#accept').addEventListener('mousedown',e=>e.preventDefault());$('#accept').addEventListener('click',insertSuggestion);
title.addEventListener('input',persist);
function renderDictionary(){const ul=$('#dictionary');ul.replaceChildren();corrections.forEach((pair,i)=>{const li=document.createElement('li'),text=document.createElement('span'),remove=document.createElement('button');text.textContent=pair.from+' → '+pair.to;remove.textContent='Удалить';remove.addEventListener('click',()=>{corrections.splice(i,1);assistant.setCorrections(corrections);persist();renderDictionary();updateBias();refresh()});li.append(text,remove);ul.append(li)})}
$('#correctionForm').addEventListener('submit',e=>{e.preventDefault();const from=$('#wrong').value.trim(),to=$('#right').value.trim();if(!from||!to)return;corrections=corrections.filter(x=>x.from!==from);corrections.push({from,to});assistant.setCorrections(corrections);persist();renderDictionary();updateBias();refresh();e.target.reset()});
$('#sendDemo').addEventListener('click',()=>{const text=$('#demo').value.trim();if(!text)return;adapter.stop();assistant.dismiss();assistant.updateHypothesis({id:'demo-'+(++demoId),final:true,alternatives:[{text,confidence:1}]},editor.value.slice(0,editor.selectionStart));$('#transcript').textContent=text;$('#hypothesisState').textContent='Тестовая фраза — не запись с микрофона';editor.focus();refresh()});
$('#export').addEventListener('click',()=>{const blob=new Blob(['# '+(title.value||'Конспект')+'\n\n'+editor.value+'\n'],{type:'text/markdown;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(title.value||'Конспект').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
renderDictionary();refresh();
