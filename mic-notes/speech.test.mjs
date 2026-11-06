import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechAdapter} from './speech.mjs';
test('does not instantiate or start microphone before explicit start',()=>{
 let created=0,started=0;
 class ASR{constructor(){created++}start(){started++}}
 const a=new SpeechAdapter({Recognition:ASR});
 assert.equal(created,0);assert.equal(started,0);
 a.start();assert.equal(created,1);assert.equal(started,1);
 a.stop();
});
test('streams alternatives with stable ids and ignores events after stop',()=>{
 let instance;const received=[];class ASR{constructor(){instance=this}start(){}abort(){}}
 const a=new SpeechAdapter({Recognition:ASR,onHypothesis:h=>received.push(h)});a.start();
 const result=Object.assign([{transcript:'Наука',confidence:.8},{transcript:'на ука',confidence:.2}],{isFinal:false});
 instance.onresult({resultIndex:0,results:[result]});
 assert.equal(received[0].alternatives[0].text,'Наука');assert.equal(received[0].final,false);
 const id=received[0].id;result.isFinal=true;instance.onresult({resultIndex:0,results:[result]});assert.equal(received[1].id,id);
 a.stop();instance.onresult({resultIndex:0,results:[result]});assert.equal(received.length,2);
});
test('reports start failures without leaving running state',()=>{
 class ASR{start(){throw Error('denied')}}const states=[];const a=new SpeechAdapter({Recognition:ASR,onStatus:s=>states.push(s)});
 assert.throws(()=>a.start(),/denied/);assert.equal(a.running,false);
});
