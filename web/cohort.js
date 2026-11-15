/* Public dataset adapter. Missing amounts remain NaN for null-safe calculations. */
(function(root){
function adapt(data){
 if(data.api_version!==1||!data.cycle||!Array.isArray(data.applications))throw Error('The cohort response is not supported.');
 const index=rows=>new Map(rows.map(r=>[r.id,r]));
 const orgs=index(data.organizations),teams=index(data.teams),questions=index(data.application_questions),tags=index(data.classification_tags);
 const responses=new Map();for(const r of data.application_responses){if(!responses.has(r.application_id))responses.set(r.application_id,{});responses.get(r.application_id)[questions.get(r.question_id)?.code]=r.original_text??r.answer_text??'';}
 const metric=(owner,code,benchmark=false)=>{const r=data.financial_values.find(v=>(benchmark?v.benchmark_id:v.period_id)===owner&&v.metric_code===code);return r?.amount==null?NaN:Number(r.amount);};
 const benchmark=data.financial_benchmarks[0];
 const groups={rev:{Program:'program','Grants/Contributions/In-Kind':'grants',Investments:'investments','Other Income':'other',Total:'total'},exp:{Program:'program','General & Administrative':'administration',Fundraising:'fundraising',Total:'total'},na:{Unrestricted:'unrestricted',Restricted:'restricted',Total:'total'}};
 const organizations=[...data.applications].sort((a,b)=>a.source_index-b.source_index).map((a,i)=>{
  const org=orgs.get(a.organization_id);if(!org)throw Error('An organization record is missing.');
  const periods=data.financial_periods.filter(p=>p.application_id===a.id);const years=[2024,2025].map(y=>periods.find(p=>p.fiscal_year===y));
  const attached=data.application_tags.filter(t=>t.application_id===a.id).map(t=>tags.get(t.tag_id)).filter(Boolean);
  const fin={};for(const [g,labels] of Object.entries(groups)){fin[g]={};for(const [label,code] of Object.entries(labels))fin[g][label]=[...years.map(p=>p?metric(p.id,g+'.'+code):NaN),benchmark?metric(benchmark.id,g+'.'+code,true):NaN];}
  fin['Audit Report']=years[1]?.audit_wording||'Not stated';fin['Year End']=years[1]?.year_end_wording||'Not stated';fin.Currency=years[1]?.source_currency_units||'Not stated';fin.src='Financial summary PDF · extracted figures; conversion details unverified';
  const answers=responses.get(a.id)||{};
  return {...answers,id:a.id,i,name:org.name,short:org.short_name||org.name,country:a.home_country||'Not stated',city:a.city||'',founded:a.founded||'Not stated',leader:a.leader||'Not stated',leaderTitle:a.leader_title||'',web:org.website||'',staffN:a.paid_staff_count??'Not stated',team:teams.get(a.team_id)?.name||'Assignment pending',sector:attached.filter(t=>t.type==='focus').map(t=>t.label).join(', ')||'Not classified',mission:answers.mission||'',overview:answers.overview||answers.mission||'',essays:Array.from({length:12},(_,j)=>answers['essay_'+String(j+1).padStart(2,'0')]||''),sdgs:attached.filter(t=>t.type==='sdg').map(t=>[Number(t.code),t.label]),countries:data.application_countries.filter(c=>c.application_id===a.id).map(c=>c.original_label),files:data.source_documents.filter(f=>f.application_id===a.id).map(f=>f.filename),fin};
 });
 return {organizations,cycle:data.cycle,teamCount:data.teams.length,results:data.latest_team_reviews||[]};
}
root.adaptLipmanCohort=adapt;if(typeof module!=='undefined')module.exports=adapt;
})(typeof window!=='undefined'?window:globalThis);
