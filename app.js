(function(){
  const LOCAL_CACHE_KEY = 'ledgerline-cache-v1';
  const PASSCODE_KEY = 'ledgerline-passcode';
  let data = { projects: [], tasks: [], plans: [], expenses: [], budgets: {} };
  let planFilter = 'all';
  let passcode = null;

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    });
  }

  // ---------- Utilities ----------
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function fmtDate(d){
    if(!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, {month:'short', day:'numeric'});
  }
  function fmtMoney(n){ return '$' + (Math.round(n*100)/100).toFixed(2); }
  function isOverdue(dateStr, done){ return dateStr && !done && dateStr < todayStr(); }
  function isToday(dateStr){ return dateStr === todayStr(); }
  function addPeriod(dateStr, period){
    const d = new Date(dateStr + 'T00:00:00');
    if(period==='daily') d.setDate(d.getDate()+1);
    else if(period==='weekly') d.setDate(d.getDate()+7);
    else if(period==='monthly') d.setMonth(d.getMonth()+1);
    else if(period==='yearly') d.setFullYear(d.getFullYear()+1);
    return d.toISOString().slice(0,10);
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function normalizeData(d){
    return {
      projects: (d && d.projects) || [],
      tasks: (d && d.tasks) || [],
      plans: (d && d.plans) || [],
      expenses: (d && d.expenses) || [],
      budgets: (d && d.budgets) || {}
    };
  }

  // ---------- Auth / login gate ----------
  function setSyncStatus(text, cls){
    const el = document.getElementById('syncStatus');
    const el2 = document.getElementById('settingsSyncStatus');
    if(el){ el.textContent = text; el.className = 'sync-status' + (cls?(' '+cls):''); }
    if(el2){ el2.textContent = text; }
  }

  async function apiGet(){
    const res = await fetch('/api/data', { headers: { 'x-app-passcode': passcode } });
    if(res.status === 401) throw new Error('unauthorized');
    if(!res.ok) throw new Error('server error');
    return res.json();
  }
  async function apiPost(payload){
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-passcode': passcode },
      body: JSON.stringify(payload)
    });
    if(res.status === 401) throw new Error('unauthorized');
    if(!res.ok) throw new Error('server error');
    return res.json();
  }

  document.getElementById('loginBtn').addEventListener('click', attemptLogin);
  document.getElementById('loginPasscode').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') attemptLogin();
  });

  async function attemptLogin(){
    const val = document.getElementById('loginPasscode').value.trim();
    const errEl = document.getElementById('loginError');
    if(!val){ errEl.textContent = 'Enter your passcode.'; return; }
    errEl.textContent = 'Checking…';
    passcode = val;
    try{
      const result = await apiGet();
      localStorage.setItem(PASSCODE_KEY, val);
      data = normalizeData(result.data);
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
      enterApp();
    }catch(err){
      errEl.textContent = 'Wrong passcode, or the server is not set up yet.';
      passcode = null;
    }
  }

  function enterApp(){
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    render();
    setSyncStatus('Synced', 'ok2');
  }

  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    localStorage.removeItem(PASSCODE_KEY);
    location.reload();
  });

  document.getElementById('syncNowBtn').addEventListener('click', syncFromServer);

  async function syncFromServer(){
    setSyncStatus('Syncing…');
    try{
      const result = await apiGet();
      if(result.data){
        data = normalizeData(result.data);
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
        render();
      }
      setSyncStatus('Synced', 'ok2');
    }catch(err){
      setSyncStatus('Offline — showing local copy', 'err');
    }
  }

  // ---------- Save (local-first, then push to server) ----------
  function save(){
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
    setSyncStatus('Saving…');
    apiPost(data).then(()=>{
      setSyncStatus('Synced', 'ok2');
    }).catch(()=>{
      setSyncStatus('Offline — saved locally, will not sync until online', 'err');
    });
  }

  // ---------- Boot ----------
  async function boot(){
    const stored = localStorage.getItem(PASSCODE_KEY);
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if(cached){
      try{ data = normalizeData(JSON.parse(cached)); }catch(e){}
    }
    if(stored){
      passcode = stored;
      enterApp();
      // refresh from server in background in case another device changed things
      try{
        const result = await apiGet();
        if(result.data){
          data = normalizeData(result.data);
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
          render();
        }
        setSyncStatus('Synced', 'ok2');
      }catch(err){
        setSyncStatus('Offline — showing local copy', 'err');
      }
    }
    // else: login screen stays visible (default state)
  }

  // ---------- Tabs ----------
  document.getElementById('tabs').addEventListener('click', (e)=>{
    const t = e.target.closest('.tab');
    if(!t) return;
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('view-'+t.dataset.tab).classList.add('active');
  });

  // ---------- Toggle forms ----------
  function wireToggle(toggleId, formId){
    document.getElementById(toggleId).addEventListener('click', ()=>{
      const f = document.getElementById(formId);
      f.style.display = f.style.display === 'none' ? 'block' : 'none';
    });
  }
  wireToggle('projectAddToggle','projectForm');
  wireToggle('taskAddToggle','taskForm');
  wireToggle('planAddToggle','planForm');
  wireToggle('expAddToggle','expForm');
  wireToggle('budgetAddToggle','budgetForm');

  // ---------- Projects ----------
  document.getElementById('pSave').addEventListener('click', ()=>{
    const name = document.getElementById('pName').value.trim();
    if(!name) return;
    data.projects.push({id:uid(), name});
    document.getElementById('pName').value='';
    document.getElementById('projectForm').style.display='none';
    save(); render();
  });

  function renderProjects(){
    const list = document.getElementById('projectList');
    const sel = document.getElementById('tProject');
    sel.innerHTML = '<option value="">None</option>' + data.projects.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if(data.projects.length===0){
      list.innerHTML = '<div class="empty">No projects yet. Group related tasks by adding one.</div>';
      return;
    }
    list.innerHTML = data.projects.map(p=>{
      const count = data.tasks.filter(t=>t.projectId===p.id && !t.done).length;
      return `<div class="row" data-id="${p.id}">
        <div class="row-top">
          <div style="flex:1;">
            <div class="row-title">${escapeHtml(p.name)}</div>
            <div class="row-meta"><span>${count} open task${count===1?'':'s'}</span></div>
          </div>
        </div>
        <div class="row-del" data-del-project="${p.id}">&times;</div>
      </div>`;
    }).join('');
  }

  // ---------- Tasks ----------
  document.getElementById('tSave').addEventListener('click', ()=>{
    const title = document.getElementById('tTitle').value.trim();
    if(!title) return;
    data.tasks.push({
      id:uid(), title,
      projectId: document.getElementById('tProject').value || null,
      priority: document.getElementById('tPriority').value,
      due: document.getElementById('tDue').value || null,
      done:false
    });
    document.getElementById('tTitle').value='';
    document.getElementById('tDue').value='';
    document.getElementById('taskForm').style.display='none';
    save(); render();
  });

  function taskRowHtml(t){
    const proj = data.projects.find(p=>p.id===t.projectId);
    const overdue = isOverdue(t.due, t.done);
    const meta = [];
    if(proj) meta.push(`<span class="meta-badge badge-pine">${escapeHtml(proj.name)}</span>`);
    if(t.priority==='high') meta.push(`<span class="meta-badge badge-gold">High priority</span>`);
    if(t.due) meta.push(`<span class="meta-badge ${overdue?'badge-rust':''}">${overdue? 'Overdue · ':''}${fmtDate(t.due)}</span>`);
    return `<div class="row ${overdue?'overdue':''} ${t.done?'done':''}" data-id="${t.id}">
      <div class="row-top">
        <div class="check ${t.done?'checked':''}" data-toggle-task="${t.id}"></div>
        <div style="flex:1;">
          <div class="row-title ${t.done?'done':''}">${escapeHtml(t.title)}</div>
          <div class="row-meta">${meta.join('')}</div>
        </div>
      </div>
      <div class="row-del" data-del-task="${t.id}">&times;</div>
    </div>`;
  }

  function renderTasks(){
    const list = document.getElementById('taskList');
    const sorted = [...data.tasks].sort((a,b)=>{
      if(a.done!==b.done) return a.done? 1 : -1;
      return (a.due||'9999').localeCompare(b.due||'9999');
    });
    list.innerHTML = sorted.length ? sorted.map(taskRowHtml).join('') : '<div class="empty">No tasks yet. Add your first one above.</div>';
  }

  // ---------- Plans ----------
  document.getElementById('plSave').addEventListener('click', ()=>{
    const title = document.getElementById('plTitle').value.trim();
    if(!title) return;
    data.plans.push({
      id:uid(), title,
      period: document.getElementById('plPeriod').value,
      due: document.getElementById('plDue').value || null,
      done:false,
      repeat: document.getElementById('plRepeat').checked
    });
    document.getElementById('plTitle').value='';
    document.getElementById('plDue').value='';
    document.getElementById('plRepeat').checked=false;
    document.getElementById('planForm').style.display='none';
    save(); render();
  });

  document.getElementById('periodFilter').addEventListener('click',(e)=>{
    const b = e.target.closest('.pf-btn');
    if(!b) return;
    planFilter = b.dataset.p;
    document.querySelectorAll('.pf-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderPlans();
  });

  function planRowHtml(p){
    const overdue = isOverdue(p.due, p.done);
    const meta = [`<span class="meta-badge badge-pine">${p.period}</span>`];
    if(p.due) meta.push(`<span class="meta-badge ${overdue?'badge-rust':''}">${overdue?'Overdue · ':''}${fmtDate(p.due)}</span>`);
    if(p.repeat) meta.push(`<span class="meta-badge badge-gold">↻ repeats</span>`);
    return `<div class="row ${overdue?'overdue':''} ${p.done?'done':''}">
      <div class="row-top">
        <div class="check ${p.done?'checked':''}" data-toggle-plan="${p.id}"></div>
        <div style="flex:1;">
          <div class="row-title ${p.done?'done':''}">${escapeHtml(p.title)}</div>
          <div class="row-meta">${meta.join('')}</div>
        </div>
      </div>
      <div class="row-del" data-del-plan="${p.id}">&times;</div>
    </div>`;
  }

  function renderPlans(){
    const list = document.getElementById('planList');
    let items = [...data.plans];
    if(planFilter!=='all') items = items.filter(p=>p.period===planFilter);
    items.sort((a,b)=>{
      if(a.done!==b.done) return a.done?1:-1;
      return (a.due||'9999').localeCompare(b.due||'9999');
    });
    list.innerHTML = items.length ? items.map(planRowHtml).join('') : '<div class="empty">No plan items in this period yet.</div>';
  }

  // ---------- Expenses ----------
  document.getElementById('eSave').addEventListener('click', ()=>{
    const amount = parseFloat(document.getElementById('eAmount').value);
    if(!amount || amount<=0) return;
    data.expenses.push({
      id:uid(), amount,
      category: document.getElementById('eCategory').value,
      date: document.getElementById('eDate').value || todayStr(),
      note: document.getElementById('eNote').value.trim()
    });
    document.getElementById('eAmount').value='';
    document.getElementById('eNote').value='';
    document.getElementById('expForm').style.display='none';
    save(); render();
  });

  document.getElementById('bSave').addEventListener('click', ()=>{
    const cat = document.getElementById('bCategory').value;
    const limit = parseFloat(document.getElementById('bLimit').value);
    if(!limit || limit<=0) return;
    data.budgets[cat] = limit;
    document.getElementById('bLimit').value='';
    document.getElementById('budgetForm').style.display='none';
    save(); render();
  });

  function currentMonthKey(){ return todayStr().slice(0,7); }

  function renderExpenses(){
    const monthKey = currentMonthKey();
    const monthExpenses = data.expenses.filter(e=>e.date && e.date.slice(0,7)===monthKey);
    const total = monthExpenses.reduce((s,e)=>s+e.amount,0);
    document.getElementById('expMonthTotal').textContent = fmtMoney(total);
    document.getElementById('expMonthLabel').textContent = 'Spent in ' + new Date(monthKey+'-01T00:00:00').toLocaleDateString(undefined,{month:'long', year:'numeric'});

    const byCat = {};
    monthExpenses.forEach(e=>{ byCat[e.category] = (byCat[e.category]||0) + e.amount; });
    Object.keys(data.budgets).forEach(cat=>{ if(!(cat in byCat)) byCat[cat]=0; });
    const catEl = document.getElementById('expByCategory');
    const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    catEl.innerHTML = cats.length ? cats.map(([cat,amt])=>{
      const budget = data.budgets[cat];
      let pct, fillColor, tag='';
      if(budget){
        pct = Math.min(100, Math.round(amt/budget*100));
        const over = amt > budget;
        const near = !over && amt >= budget*0.9;
        fillColor = over ? 'var(--rust)' : (near ? 'var(--gold)' : 'var(--pine)');
        tag = over ? ' · over budget' : (near ? ' · near limit' : '');
      }else{
        pct = total>0 ? Math.round(amt/total*100) : 0;
        fillColor = 'var(--pine)';
      }
      const rightLabel = budget ? `${fmtMoney(amt)} / ${fmtMoney(budget)}${tag}` : fmtMoney(amt);
      return `<div class="cat-bar-wrap">
        <div class="cat-bar-head"><span>${escapeHtml(cat)}</span><span style="${budget && amt>budget?'color:var(--rust); font-weight:600;':''}">${rightLabel}</span></div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%; background:${fillColor};"></div></div>
      </div>`;
    }).join('') : '<div class="empty">No expenses or budgets set for this month.</div>';

    const listEl = document.getElementById('expList');
    const recent = [...data.expenses].sort((a,b)=> (b.date||'').localeCompare(a.date||'')).slice(0,20);
    listEl.innerHTML = recent.length ? recent.map(e=>`
      <div class="row" data-id="${e.id}">
        <div class="row-top">
          <div style="flex:1;">
            <div class="row-title">${fmtMoney(e.amount)} <span style="font-weight:400; color:var(--ink-soft); font-size:13px;">— ${escapeHtml(e.category)}</span></div>
            <div class="row-meta"><span>${fmtDate(e.date)}</span>${e.note?`<span>${escapeHtml(e.note)}</span>`:''}</div>
          </div>
        </div>
        <div class="row-del" data-del-expense="${e.id}">&times;</div>
      </div>
    `).join('') : '<div class="empty">No expenses yet.</div>';
  }

  // ---------- Dashboard ----------
  function renderDashboard(){
    const openTasks = data.tasks.filter(t=>!t.done);
    const overdueTasks = data.tasks.filter(t=>isOverdue(t.due,t.done));
    const overduePlans = data.plans.filter(p=>isOverdue(p.due,p.done));
    const overdueCount = overdueTasks.length + overduePlans.length;

    document.getElementById('statOpen').textContent = openTasks.length;
    document.getElementById('statOverdue').textContent = overdueCount;

    const monthKey = currentMonthKey();
    const spend = data.expenses.filter(e=>e.date && e.date.slice(0,7)===monthKey).reduce((s,e)=>s+e.amount,0);
    document.getElementById('statSpend').textContent = fmtMoney(spend).replace('.00','');

    const monthExpB = data.expenses.filter(e=>e.date && e.date.slice(0,7)===monthKey);
    const byCatB = {};
    monthExpB.forEach(e=>{ byCatB[e.category] = (byCatB[e.category]||0) + e.amount; });
    const overBudgetCats = Object.keys(data.budgets).filter(cat=> (byCatB[cat]||0) > data.budgets[cat]);

    const banner = document.getElementById('alertBanner');
    const parts = [];
    if(overdueCount>0) parts.push(`<b>${overdueCount} item${overdueCount===1?'':'s'} overdue.</b> Check Tasks or Plans.`);
    if(overBudgetCats.length>0) parts.push(`<b>${overBudgetCats.length} budget${overBudgetCats.length===1?'':'s'} exceeded</b> (${overBudgetCats.map(escapeHtml).join(', ')}).`);
    if(parts.length){
      banner.classList.add('show');
      banner.innerHTML = parts.join(' ');
    }else{
      banner.classList.remove('show');
    }

    const todayOrOverdue = [
      ...data.tasks.filter(t=>!t.done && t.due && (t.due<=todayStr())).map(t=>({...t,kind:'task'})),
      ...data.plans.filter(p=>!p.done && p.due && (p.due<=todayStr())).map(p=>({...p,kind:'plan'}))
    ].sort((a,b)=>(a.due||'').localeCompare(b.due||''));

    const dashOverdue = document.getElementById('dashOverdue');
    dashOverdue.innerHTML = todayOrOverdue.length ? todayOrOverdue.map(item=>
      item.kind==='task' ? taskRowHtml(item) : planRowHtml(item)
    ).join('') : '<div class="empty">Nothing overdue or due today. Well kept.</div>';

    const in7 = new Date(); in7.setDate(in7.getDate()+7);
    const in7Str = in7.toISOString().slice(0,10);
    const upcoming = [
      ...data.tasks.filter(t=>!t.done && t.due && t.due>todayStr() && t.due<=in7Str).map(t=>({...t,kind:'task'})),
      ...data.plans.filter(p=>!p.done && p.due && p.due>todayStr() && p.due<=in7Str).map(p=>({...p,kind:'plan'}))
    ].sort((a,b)=>(a.due||'').localeCompare(b.due||''));

    const dashUpcoming = document.getElementById('dashUpcoming');
    dashUpcoming.innerHTML = upcoming.length ? upcoming.map(item=>
      item.kind==='task' ? taskRowHtml(item) : planRowHtml(item)
    ).join('') : '<div class="empty">Nothing scheduled in the next 7 days.</div>';
  }

  // ---------- Schedule ----------
  function renderSchedule(){
    const items = [
      ...data.tasks.filter(t=>t.due).map(t=>({...t,kind:'task'})),
      ...data.plans.filter(p=>p.due).map(p=>({...p,kind:'plan'})),
      ...data.expenses.map(e=>({...e,kind:'expense', due:e.date}))
    ].sort((a,b)=>(a.due||'').localeCompare(b.due||''));

    const groups = {};
    items.forEach(it=>{ (groups[it.due] = groups[it.due]||[]).push(it); });
    const dates = Object.keys(groups).sort();

    const el = document.getElementById('scheduleList');
    if(dates.length===0){ el.innerHTML = '<div class="empty">Nothing scheduled yet. Add tasks, plans, or expenses with dates.</div>'; return; }

    el.innerHTML = dates.map(d=>{
      const label = new Date(d+'T00:00:00').toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
      const rows = groups[d].map(it=>{
        if(it.kind==='task') return taskRowHtml(it);
        if(it.kind==='plan') return planRowHtml(it);
        return `<div class="row"><div class="row-top"><div style="flex:1;">
          <div class="row-title">${fmtMoney(it.amount)} <span style="font-weight:400; color:var(--ink-soft); font-size:13px;">— ${escapeHtml(it.category)}</span></div>
        </div></div></div>`;
      }).join('');
      return `<div class="day-group"><div class="day-label ${isToday(d)?'today':''}">${isToday(d)?'Today · ':''}${label}</div>${rows}</div>`;
    }).join('');
  }

  // ---------- Export / Import ----------
  function downloadBlob(content, filename, mime){
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function csvEscape(v){
    const s = String(v==null?'':v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }

  document.getElementById('exportJsonBtn').addEventListener('click', ()=>{
    downloadBlob(JSON.stringify(data, null, 2), `ledgerline-backup-${todayStr()}.json`, 'application/json');
  });

  document.getElementById('exportExpCsvBtn').addEventListener('click', ()=>{
    const rows = [['date','category','amount','note']];
    data.expenses.forEach(e=> rows.push([e.date, e.category, e.amount, e.note||'']));
    downloadBlob(rows.map(r=>r.map(csvEscape).join(',')).join('\n'), `expenses-${todayStr()}.csv`, 'text/csv');
  });

  document.getElementById('exportTaskCsvBtn').addEventListener('click', ()=>{
    const rows = [['title','project','priority','due','done']];
    data.tasks.forEach(t=>{
      const proj = data.projects.find(p=>p.id===t.projectId);
      rows.push([t.title, proj?proj.name:'', t.priority, t.due||'', t.done?'yes':'no']);
    });
    downloadBlob(rows.map(r=>r.map(csvEscape).join(',')).join('\n'), `tasks-${todayStr()}.csv`, 'text/csv');
  });

  document.getElementById('importJsonInput').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const statusEl = document.getElementById('importStatus');
    const reader = new FileReader();
    reader.onload = (evt)=>{
      try{
        const parsed = JSON.parse(evt.target.result);
        if(typeof parsed !== 'object' || parsed === null) throw new Error('bad shape');
        data = normalizeData(parsed);
        save(); render();
        statusEl.style.color = 'var(--pine)';
        statusEl.textContent = 'Backup restored and synced.';
      }catch(err){
        statusEl.style.color = 'var(--rust)';
        statusEl.textContent = 'Could not read that file — make sure it is a Ledgerline JSON backup.';
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // ---------- Event delegation ----------
  document.body.addEventListener('click', (e)=>{
    const tt = e.target.closest('[data-toggle-task]');
    if(tt){ const t = data.tasks.find(x=>x.id===tt.dataset.toggleTask); if(t){ t.done=!t.done; save(); render(); } return; }

    const tp = e.target.closest('[data-toggle-plan]');
    if(tp){
      const p = data.plans.find(x=>x.id===tp.dataset.togglePlan);
      if(p){
        p.done = !p.done;
        if(p.done && p.repeat){
          const base = p.due || todayStr();
          data.plans.push({
            id:uid(), title:p.title, period:p.period,
            due: addPeriod(base, p.period), done:false, repeat:true
          });
        }
        save(); render();
      }
      return;
    }

    const dt = e.target.closest('[data-del-task]');
    if(dt){ data.tasks = data.tasks.filter(x=>x.id!==dt.dataset.delTask); save(); render(); return; }

    const dp = e.target.closest('[data-del-plan]');
    if(dp){ data.plans = data.plans.filter(x=>x.id!==dp.dataset.delPlan); save(); render(); return; }

    const de = e.target.closest('[data-del-expense]');
    if(de){ data.expenses = data.expenses.filter(x=>x.id!==de.dataset.delExpense); save(); render(); return; }

    const dpr = e.target.closest('[data-del-project]');
    if(dpr){
      const pid = dpr.dataset.delProject;
      data.projects = data.projects.filter(x=>x.id!==pid);
      data.tasks.forEach(t=>{ if(t.projectId===pid) t.projectId=null; });
      save(); render(); return;
    }
  });

  // Refresh from server whenever the app regains focus (covers switching back from another device's changes)
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && passcode){
      syncFromServer();
    }
  });

  function render(){
    document.getElementById('todayLabel').textContent = new Date().toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric', year:'numeric'});
    renderProjects();
    renderTasks();
    renderPlans();
    renderExpenses();
    renderDashboard();
    renderSchedule();
  }

  boot();
})();
