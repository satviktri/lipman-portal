/* Pure cohort operations, shared by the interface and regression tests. */
(function(root){
const statuses=['Unreviewed','Consider','Discuss','Finalist','Alternate','Not advancing'];
const number=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const unique=a=>[...new Set(a)];
function contexts(data){
 const specs=data.rubricCriteria||[],latest=new Map();
 for(const r of data.results||[]){const key=JSON.stringify([r.application_id,r.team_id,r.stage,r.rubric_id]);if(!latest.has(key)||r.revision>latest.get(key).revision)latest.set(key,r);}
 const groups=new Map();
 for(const r of latest.values()){
  const criteria=specs.filter(c=>c.rubric_id===r.rubric_id).sort((a,b)=>a.display_order-b.display_order);
  const id=JSON.stringify([r.stage,r.rubric_id,criteria.map(c=>[c.code,c.min_score,c.max_score])]);
  if(!groups.has(id))groups.set(id,{id,stage:r.stage,rubricId:r.rubric_id,criteria,reviews:[],label:r.stage+' · '+(data.rubrics.find(v=>v.id===r.rubric_id)?.version||r.rubric_id)});
  groups.get(id).reviews.push(r);
 }
 if(!groups.size){const v=data.rubrics[0];groups.set('pending',{id:'pending',stage:null,rubricId:v?.id,criteria:specs.filter(c=>c.rubric_id===v?.id).sort((a,b)=>a.display_order-b.display_order),reviews:[],label:'Team ratings pending'});}
 return [...groups.values()].sort((a,b)=>a.label.localeCompare(b.label));
}
function rating(o,context,data){
 const review=context.reviews.find(r=>r.application_id===o.id&&r.team_id===o.teamId),scores={};
 if(review)for(const c of context.criteria){const raw=data.teamScores.find(s=>s.review_id===review.id&&s.criterion_id===c.id),n=number(raw?.score);if(n!==null&&n>=Number(c.min_score)&&n<=Number(c.max_score))scores[c.code]=n;}
 const values=Object.values(scores),overall=number(review?.reported_overall),complete=context.criteria.length>0&&values.length===context.criteria.length;
 const sameScale=new Set(context.criteria.map(c=>`${c.min_score}:${c.max_score}`)).size<=1;
 return {review,scores,overall,count:values.length,status:complete?'Complete':values.length?'Partial':overall!==null?'Overall only':'Pending',average:complete&&sameScale?values.reduce((a,b)=>a+b,0)/values.length:null};
}
function validateConfig(config,orgs){
 if(config.version!==1||!Array.isArray(config.categories)||!Array.isArray(config.views))throw Error('Unsupported category configuration');
 const ids=new Set(orgs.map(o=>o.id)),seen=new Set();
 for(const c of config.categories){if(!/^[a-z0-9_-]+$/.test(c.id)||seen.has(c.id)||typeof c.name!=='string'||!c.name.trim()||!Array.isArray(c.applicationIds)||c.applicationIds.some(id=>!ids.has(id)))throw Error('Invalid category definition');seen.add(c.id);}
 const views=new Set();for(const v of config.views){if(!/^[a-z0-9_-]+$/.test(v.id)||views.has(v.id)||typeof v.name!=='string'||!v.filters||typeof v.filters!=='object')throw Error('Invalid saved view');views.add(v.id);for(const [k,a] of Object.entries(v.filters))if(!['team','country','operating','sdg','topic','category','rating','size','decision','alert'].includes(k)||!Array.isArray(a)||a.some(x=>typeof x!=='string')||(k==='category'&&a.some(x=>!seen.has(x))))throw Error('Invalid saved filter');}
 return config;
}
function memberships(o,key,config,state){switch(key){case'alert':return root.FinancialReview.analyze(o).categories;case'team':return[o.team];case'country':return[o.country];case'operating':return unique(o.countries);case'sdg':return o.sdgs.map(s=>String(s[0]));case'topic':return o.topics.length?o.topics:['Not classified'];case'category':return config.categories.filter(c=>c.applicationIds.includes(o.id)).map(c=>c.id);case'decision':return[state[o.id]?.status||'Unreviewed'];case'size':return[!Number.isFinite(o.r25)?'Missing':o.r25<1e6?'Under $1M':o.r25<=5e6?'$1M–$5M':'Over $5M'];default:return[];}}
function filter(orgs,filters,query,context,data,config,state){return orgs.filter(o=>(!query||[o.name,o.short,o.mission,...o.countries,...o.topics].join(' ').toLowerCase().includes(query.toLowerCase()))&&Object.entries(filters).every(([key,values])=>!values.length||values.some(v=>(key==='rating'?[rating(o,context,data).status]:memberships(o,key,config,state)).includes(v))));}
function sort(orgs,key,direction,context,data){const val=o=>key.startsWith('financial:')?root.FinancialReview.analyze(o).metrics[key.slice(10)]:key==='name'?o.name:key==='team'?o.team:key==='overall'?rating(o,context,data).overall:key==='average'?rating(o,context,data).average:key.startsWith('criterion:')?rating(o,context,data).scores[key.slice(10)]:o[key];return [...orgs].sort((a,b)=>{const x=val(a),y=val(b),missing=v=>v==null||typeof v==='number'&&!Number.isFinite(v);if(missing(x)||missing(y))return missing(x)===missing(y)?a.name.localeCompare(b.name):missing(x)?1:-1;return direction*(typeof x==='string'?x.localeCompare(y):x-y)||a.name.localeCompare(b.name);});}
function group(orgs,key,config,state){if(!key)return[['All organizations',orgs]];const groups=new Map();for(const o of orgs)for(const label of unique(memberships(o,key,config,state).length?memberships(o,key,config,state):['Uncategorized'])){if(!groups.has(label))groups.set(label,[]);groups.get(label).push(o);}return [...groups].sort((a,b)=>a[0].localeCompare(b[0]));}
function summary(orgs,context,data){const r=orgs.map(o=>rating(o,context,data));return {count:orgs.length,complete:r.filter(x=>x.status==='Complete').length,withResults:r.filter(x=>x.status!=='Pending').length,criteria:context.criteria.map(c=>{const v=r.map(x=>x.scores[c.code]).filter(x=>x!=null);return{...c,count:v.length,average:v.length?v.reduce((a,b)=>a+b,0)/v.length:null};})};}
function decision(state,id,status,reason,swapId){if(!statuses.includes(status))throw Error('Unknown decision');const next=JSON.parse(JSON.stringify(state));if(status==='Finalist'&&next[id]?.status!=='Finalist'&&Object.values(next).filter(v=>v.status==='Finalist').length>=12){if(!swapId||swapId===id||next[swapId]?.status!=='Finalist')throw Error('Choose a finalist to move to Alternates before adding another.');next[swapId]={...next[swapId],status:'Alternate'};}next[id]={status,reason:reason??next[id]?.reason??''};return next;}
function restore(raw,orgs){
 if(!raw||!['lipman-review-v2','lipman-review-v3'].includes(raw.format)||!raw.scores||typeof raw.scores!=='object'||Array.isArray(raw.scores))throw Error('Not a Lipman backup');
 if(raw.format==='lipman-review-v2'&&!Array.isArray(raw.shortlist)||raw.format==='lipman-review-v3'&&(!raw.decisions||typeof raw.decisions!=='object'||Array.isArray(raw.decisions)))throw Error('Invalid decisions');
 const scores={},decisions={};for(const o of orgs){const r=raw.scores[raw.format==='lipman-review-v2'?o.name:o.id];if(r!=null){if(typeof r!=='object'||Array.isArray(r))throw Error('Invalid scores');scores[o.id]={};for(let i=0;i<6;i++){const score=r['c'+i],note=r['n'+i];if(score!=null){if(!Number.isInteger(score)||score<1||score>5)throw Error('Personal scores must be 1–5');scores[o.id]['c'+i]=score;}if(note!=null){if(typeof note!=='string'||note.length>100000)throw Error('Invalid note');scores[o.id]['n'+i]=note;}}}
 const d=raw.format==='lipman-review-v2'?(raw.shortlist.includes(o.name)?{status:'Finalist',reason:''}:null):raw.decisions[o.id];if(d){if(!statuses.includes(d.status)||typeof d.reason!=='string'||d.reason.length>100000)throw Error('Invalid decision');decisions[o.id]={status:d.status,reason:d.reason};}}
 if(Object.values(decisions).filter(d=>d.status==='Finalist').length>12)throw Error('A shortlist cannot exceed 12 finalists');return{scores,decisions};
}
root.ReviewCore={statuses,number,contexts,rating,validateConfig,memberships,filter,sort,group,summary,decision,restore};if(typeof module!=='undefined')module.exports=root.ReviewCore;
})(typeof window!=='undefined'?window:globalThis);
