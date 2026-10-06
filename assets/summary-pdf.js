/* UK Expat Mortgages: downloadable PDF summary for the calculators.
   Each page defines window.buildSummary() returning:
   { title, subtitle, filename, highlights:[[label,value,sub]], sections:[{heading, rows:[[label,value]], note}], disclaimers:[text] }
   jsPDF is loaded from cdnjs only when the visitor asks for the PDF. */
(function(){
  var JSPDF='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var loading=null;
  function loadJsPDF(){
    if(window.jspdf&&window.jspdf.jsPDF)return Promise.resolve();
    if(loading)return loading;
    loading=new Promise(function(res,rej){
      var s=document.createElement('script');s.src=JSPDF;s.async=true;
      s.onload=function(){res();};s.onerror=function(){loading=null;rej(new Error('load'));};
      document.head.appendChild(s);
    });
    return loading;
  }
  // Standard PDF fonts only cover basic Latin, so tidy any other characters
  function clean(t){
    return String(t==null?'':t)
      .replace(/[‘’]/g,"'").replace(/[“”]/g,'"')
      .replace(/[–—]/g,', ').replace(/→/g,'').replace(/·/g,'-')
      .replace(/…/g,'...').replace(/ /g,' ')
      .replace(/[^\x0A\x20-\x7E£ -ÿ]/g,'').replace(/[ \t]+/g,' ').trim();
  }
  var NAVY=[14,59,83],GOLD=[200,155,60],INK=[16,34,46],SOFT=[68,88,106],LINE=[228,224,214],TINT=[241,237,228];

  function render(d){
    var jsPDF=window.jspdf.jsPDF;
    var doc=new jsPDF({unit:'mm',format:'a4'});
    var W=210,H=297,M=16,CW=W-2*M,y=0;
    var today=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});

    function header(first){
      doc.setFillColor.apply(doc,NAVY);doc.rect(0,0,W,first?40:16,'F');
      doc.setFillColor.apply(doc,GOLD);doc.rect(0,first?40:16,W,1.2,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(first?15:11);
      doc.setTextColor(255,255,255);doc.text('UK Expat',M,first?13:10);
      var w=doc.getTextWidth('UK Expat ');doc.setTextColor.apply(doc,GOLD);doc.text('Mortgages',M+w,first?13:10);
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(185,203,214);
      doc.text('uk-expat-mortgage.co.uk',W-M,first?13:10,{align:'right'});
      if(first){
        doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(255,255,255);
        doc.text(clean(d.title),M,25);
        doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(227,200,137);
        doc.text(clean(d.subtitle||'')+(d.subtitle?'  |  ':'')+'Prepared '+today,M,33);
        y=48;
      } else y=24;
    }
    function ensure(h){ if(y+h>H-22){doc.addPage();header(false);} }
    function para(t,size,color,bold,gap){
      doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor.apply(doc,color);
      var lines=doc.splitTextToSize(clean(t),CW);
      lines.forEach(function(l){
        ensure(size*0.45);
        doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor.apply(doc,color);
        doc.text(l,M,y);y+=size*0.42;
      });
      y+=gap||0;
    }

    header(true);

    // Notice
    var notice='Indicative guide only. This is not a quote, a mortgage offer or advice. All figures are subject to status, the lender\'s criteria and the lender\'s valuation of the property.';
    doc.setFontSize(9);var nl=doc.splitTextToSize(clean(notice),CW-8);
    doc.setFillColor.apply(doc,TINT);doc.rect(M,y,CW,nl.length*4+6,'F');
    doc.setFillColor.apply(doc,GOLD);doc.rect(M,y,1.4,nl.length*4+6,'F');
    doc.setFont('helvetica','normal');doc.setTextColor.apply(doc,INK);
    nl.forEach(function(l,i){doc.text(l,M+5,y+5.5+i*4);});
    y+=nl.length*4+12;

    // Highlights
    var hl=(d.highlights||[]).filter(function(h){return h&&h[1];});
    if(hl.length){
      var gap=4,bw=(CW-gap*(hl.length-1))/hl.length,bh=24;
      hl.forEach(function(h,i){
        var x=M+i*(bw+gap);
        doc.setFillColor.apply(doc,i===0?NAVY:[255,255,255]);doc.setDrawColor.apply(doc,i===0?NAVY:LINE);
        doc.roundedRect(x,y,bw,bh,2,2,i===0?'F':'FD');
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor.apply(doc,i===0?[185,203,214]:SOFT);
        doc.text(doc.splitTextToSize(clean(h[0]),bw-8)[0],x+4,y+7);
        doc.setFont('helvetica','bold');doc.setFontSize(hl.length>3?14:16);doc.setTextColor.apply(doc,i===0?[255,255,255]:NAVY);
        doc.text(clean(h[1]),x+4,y+15.5);
        if(h[2]){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor.apply(doc,i===0?[227,200,137]:SOFT);
          doc.text(doc.splitTextToSize(clean(h[2]),bw-8)[0],x+4,y+21);}
      });
      y+=bh+9;
    }

    // Sections
    (d.sections||[]).forEach(function(sec){
      var rows=(sec.rows||[]).filter(function(r){return r&&r[1]!==''&&r[1]!=null;});
      if(!rows.length&&!sec.note)return;
      ensure(16);
      doc.setFont('helvetica','bold');doc.setFontSize(11.5);doc.setTextColor.apply(doc,NAVY);
      doc.text(clean(sec.heading),M,y);y+=2.5;
      doc.setDrawColor.apply(doc,GOLD);doc.setLineWidth(0.5);doc.line(M,y,M+18,y);doc.setLineWidth(0.2);y+=5;
      rows.forEach(function(r){
        doc.setFontSize(9.2);
        var lw=CW*0.52,vw=CW*0.46;
        doc.setFont('helvetica','normal');var ll=doc.splitTextToSize(clean(r[0]),lw);
        doc.setFont('helvetica','bold');var vl=doc.splitTextToSize(clean(r[1]),vw);
        var h=Math.max(ll.length,vl.length)*4.1+2.6;
        ensure(h);
        doc.setFont('helvetica','normal');doc.setTextColor.apply(doc,SOFT);
        ll.forEach(function(l,i){doc.text(l,M,y+i*4.1);});
        doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,r[2]?NAVY:INK);
        vl.forEach(function(l,i){doc.text(l,W-M,y+i*4.1,{align:'right'});});
        y+=h-2.6+1.2;doc.setDrawColor.apply(doc,LINE);doc.line(M,y,W-M,y);y+=3.4;
      });
      if(sec.note){y+=0.5;para(sec.note,8.2,SOFT,false,1);}
      y+=4;
    });

    // Next steps: adviser contact
    var C=d.contact||{name:'John Florey',role:'Specialist UK Expat Mortgage Adviser',lines:[['Email','john.florey@opesfp.com'],['Website','www.uk-expat-mortgage.co.uk']]};
    var bh2=22+C.lines.length*5.2;
    ensure(bh2+6);
    doc.setFillColor.apply(doc,TINT);doc.roundedRect(M,y,CW,bh2,2,2,'F');
    doc.setFillColor.apply(doc,GOLD);doc.rect(M,y,1.4,bh2,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor.apply(doc,NAVY);
    doc.text('Ready to take it further? Speak to your adviser',M+6,y+7);
    doc.setFont('helvetica','normal');doc.setFontSize(8.6);doc.setTextColor.apply(doc,SOFT);
    doc.text('Rates and criteria vary by lender. Your adviser will recommend the most suitable lender for your requirements.',M+6,y+12);
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor.apply(doc,INK);
    doc.text(clean(C.name)+(C.role?', '+clean(C.role):''),M+6,y+18);
    C.lines.forEach(function(l,i){
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor.apply(doc,SOFT);doc.text(clean(l[0]),M+6,y+23.2+i*5.2);
      doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,NAVY);doc.text(clean(l[1]),M+28,y+23.2+i*5.2);
    });
    y+=bh2+8;

    // Important information
    ensure(20);
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor.apply(doc,NAVY);
    doc.text('Important information',M,y);y+=6;
    para('YOUR HOME OR PROPERTY MAY BE REPOSSESSED IF YOU DO NOT KEEP UP REPAYMENTS ON A MORTGAGE OR ANY OTHER DEBT SECURED ON IT.',8.2,INK,true,2);
    (d.disclaimers||[]).forEach(function(t){para(t,7.6,SOFT,false,1.6);});

    // Footer on every page
    var n=doc.getNumberOfPages();
    for(var p=1;p<=n;p++){
      doc.setPage(p);
      doc.setDrawColor.apply(doc,LINE);doc.line(M,H-14,W-M,H-14);
      doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor.apply(doc,SOFT);
      doc.text('Indicative guide only, not a quote or offer of lending. Prepared '+today+'.',M,H-9.5);
      doc.text('Page '+p+' of '+n,W-M,H-9.5,{align:'right'});
    }
    doc.save(d.filename||'uk-expat-mortgages-summary.pdf');
  }

  window.downloadSummaryPDF=function(btn){
    var label=btn?btn.innerHTML:'';
    if(btn){btn.disabled=true;btn.innerHTML='Preparing your PDF...';}
    loadJsPDF().then(function(){
      render(window.buildSummary());
    }).catch(function(){
      alert('Sorry, the PDF could not be created just now. Please check your connection and try again.');
    }).then(function(){if(btn){btn.disabled=false;btn.innerHTML=label;}});
  };
})();
