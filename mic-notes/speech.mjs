export class SpeechAdapter {
 constructor({Recognition,onStatus=()=>{},onHypothesis=()=>{}}={}){this.Recognition=Recognition;this.onStatus=onStatus;this.onHypothesis=onHypothesis;this.recognition=null;this.running=false;this.session=0;}
 start(){
  if(!this.Recognition)throw Error('Браузер не поддерживает распознавание речи');
  if(this.running)return;
  const r=new this.Recognition();this.recognition=r;this.running=true;const session=++this.session;
  r.lang='ru-RU';r.interimResults=true;r.continuous=true;r.maxAlternatives=3;
  r.onstart=()=>{if(this.running&&session===this.session)this.onStatus('listening')};
  r.onresult=e=>{if(!this.running||session!==this.session)return;for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i];this.onHypothesis({id:`${session}:${i}`,final:result.isFinal,alternatives:Array.from(result,a=>({text:a.transcript,confidence:a.confidence}))});}};
  r.onerror=e=>{if(session!==this.session)return;this.running=false;this.onStatus('error',e.error)};
  r.onend=()=>{if(session!==this.session)return;this.running=false;this.onStatus('stopped')};
  try{r.start();this.onStatus('starting')}catch(e){this.running=false;this.onStatus('error',e.message);throw e;}
 }
 stop(){this.running=false;this.recognition?.abort?.();this.onStatus('stopped');}
}
