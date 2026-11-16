(async function(){
 const app=document.getElementById('app');app.innerHTML='<div class="card"><h1>Loading the cohort…</h1><p>Retrieving the latest applications and financials.</p></div>';
 try{
  const response=await fetch('https://ndzmkxsyktjtidaaryae.supabase.co/rest/v1/rpc/get_cycle_data?cycle_year=2027',{headers:{apikey:'sb_publishable_1_96Sc9XHmDMpNk3SDVQ1Q_bR7zU58s'},signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(!response.ok)throw Error('The data service returned '+response.status);
  window.LipmanData=adaptLipmanCohort(await response.json());
  if(!LipmanData.organizations.length)throw Error('No applications were returned.');
  const configResponse=await fetch('web/categories.json',{cache:'no-store'});
  if(!configResponse.ok)throw Error('Shared categories could not be loaded');
  LipmanData.config=ReviewCore.validateConfig(await configResponse.json(),LipmanData.organizations);
  for(const src of ['web/portal.js','web/workspace.js'])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});
 }catch(error){console.error('Cohort loading failed:',error);showError();}
 function showError(){app.innerHTML='<div class="card"><h1>The cohort could not be loaded.</h1><p>Please check your connection and try again.</p><button class="btn" onclick="location.reload()">Try again</button></div>';}
})();
