/* UK Expat Mortgages: credit enquiries to the estate agent who sent the client.
   Agent links carry ?an=<agent name>&ag=<agency>. The details are kept on the
   visitor's device for 90 days and added to any enquiry form they send. */
(function(){
  var KEY='uem_agent_ref',DAYS=90,ref=null;
  try{
    var q=new URLSearchParams(location.search),an=(q.get('an')||'').slice(0,80),ag=(q.get('ag')||'').slice(0,80);
    if(an||ag){ref={an:an,ag:ag,t:Date.now()};localStorage.setItem(KEY,JSON.stringify(ref));}
    else{ref=JSON.parse(localStorage.getItem(KEY)||'null');if(ref&&Date.now()-ref.t>DAYS*864e5){localStorage.removeItem(KEY);ref=null;}}
  }catch(e){ref=null;}
  if(!ref)return;
  var who=[ref.an,ref.ag].filter(Boolean).join(', ');
  function tag(){
    document.querySelectorAll('form[action*="formsubmit.co"]').forEach(function(f){
      if(f.id==='referForm'||f.dataset.agentTagged)return;f.dataset.agentTagged='1';
      var h=document.createElement('input');h.type='hidden';h.name='referred_by_estate_agent';h.value=who;f.appendChild(h);
      var s=f.querySelector('input[name="_subject"]');if(s)s.value='Agent referral ('+who+'): '+s.value;
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tag);else tag();
})();
