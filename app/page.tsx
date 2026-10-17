'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, ClipboardList, Folder, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, Sparkles, Target, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string; name: string; description: string | null;
  status: 'active'|'paused'|'completed'|'archived'; target_date: string | null;
  created_at: string;
};
type Task = {
  id: string; project_id: string; title: string; description: string | null;
  status: 'todo'|'in_progress'|'blocked'|'done';
  priority: 'low'|'medium'|'high'; due_at: string | null;
  parent_task_id: string | null; assigned_to: string | null; created_at: string;
};
type NewTask = { title: string; priority: Task['priority']; due: string };

const prettyDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'}) : 'No deadline';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
const projectMonogram = (s: string) => slug(s).slice(0,2).toUpperCase() || 'PH';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [taskModal, setTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({title:'', priority:'medium', due:''});
  const [activeView, setActiveView] = useState<'overview'|'project'>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({data, error: sessionError}) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      if (!data.session) { setUser(null); setAuthChecked(true); return; }
      const {data:verified, error: authError} = await supabase.auth.getUser();
      if (!active) return;
      if (authError) setError(authError.message);
      setUser(verified.user ?? null); setAuthChecked(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setAuthChecked(true); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    const [pr, ta] = await Promise.all([
      supabase.from('projects').select('id,name,description,status,target_date,created_at').order('created_at',{ascending:false}),
      supabase.from('tasks').select('id,project_id,title,description,status,priority,due_at,parent_task_id,assigned_to,created_at').order('created_at',{ascending:true}),
    ]);
    if (pr.error || ta.error) setError(pr.error?.message || ta.error?.message || 'Could not load projects.');
    else {
      setProjects(pr.data as Project[]);
      setTasks(ta.data as Task[]);
      setProjectId(old => old && pr.data.some(p=>p.id===old) ? old : (pr.data[0]?.id ?? null));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) { void load(); } else { setProjects([]);setTasks([]);setProjectId(null); } }, [user,load]);

  const currentProject = projects.find(p=>p.id===projectId) ?? null;
  const filteredTasks = tasks.filter(t=>t.project_id===projectId);
  const pending = tasks.filter(t=>t.status!=='done');
  const nextTasks = [...pending].sort((a,b)=>{
    if (!a.due_at) return 1; if (!b.due_at) return -1;
    return new Date(a.due_at).getTime()-new Date(b.due_at).getTime();
  }).slice(0,5);
  const progressFor = useCallback((id: string) => {
    const relevant=tasks.filter(t=>t.project_id===id);
    return relevant.length ? Math.round(100*relevant.filter(t=>t.status==='done').length/relevant.length) : 0;
  }, [tasks]);
  const totals = useMemo(()=>({all:tasks.length,completed:tasks.filter(t=>t.status==='done').length,open:pending.length}),[tasks,pending.length]);

  async function googleLogin() {
    setError(''); setBusy(true);
    const {error: authError} = await supabase.auth.signInWithOAuth({
      provider:'google',
      options: {redirectTo: window.location.origin},
    });
    if (authError) { setError(authError.message); setBusy(false); }
  }
  async function signout() { setError(''); const {error:e}=await supabase.auth.signOut(); if(e)setError(e.message); }
  async function createProject(e: FormEvent) {
    e.preventDefault(); if(!user || !projectName.trim()) return;
    setBusy(true);setError('');
    const {data,error:err}=await supabase.from('projects').insert({name:projectName.trim(),description:projectDesc.trim()||null,created_by:user.id}).select('id').single();
    if (err) setError(err.message);
    else {setProjectName('');setProjectDesc('');setProjectModal(false);await load();setProjectId(data.id);setActiveView('project');}
    setBusy(false);
  }
  async function createTask(e: FormEvent) {
    e.preventDefault(); if (!user || !projectId || !newTask.title.trim()) return;
    setBusy(true); setError('');
    const {error:err} = await supabase.from('tasks').insert({
      project_id:projectId,title:newTask.title.trim(),priority:newTask.priority,
      due_at:newTask.due ? new Date(newTask.due+'T18:00:00').toISOString() : null,
      status:'todo',created_by:user.id,
    });
    if (err) setError(err.message);
    else {setNewTask({title:'',priority:'medium',due:''});setTaskModal(false);await load();}
    setBusy(false);
  }
  async function toggleTask(task: Task) {
    setBusy(true); setError('');
    const {error:err}=await supabase.from('tasks').update({status:task.status==='done'?'todo':'done',change_source:'app'}).eq('id',task.id);
    if (err) setError(err.message); else await load();
    setBusy(false);
  }
  async function deleteTask(task: Task) {
    if (!confirm(`Delete task “${task.title}”?`)) return;
    setBusy(true);setError('');
    const {error:err}=await supabase.from('tasks').delete().eq('id',task.id);
    if (err) setError(err.message); else await load();
    setBusy(false);
  }
  function openProject(p: Project) {setProjectId(p.id);setActiveView('project');setMobileMenu(false);}

  if (!authChecked) return <div className="center-page"><LoaderCircle className="spin" size={30}/><p>Connecting to Personal Hub…</p></div>;
  if (!user) return <main className="auth-layout"><div className="auth-glow"/><section className="auth-box">
    <div className="brand-pill"><span className="brand-mark"><Sparkles size={18}/></span> Personal Hub</div>
    <div className="auth-overline">ONE HOME FOR WHAT MATTERS</div>
    <h1>Make room for<br/><em>everything else.</em></h1>
    <p>Keep Japan, your wedding, work, and everyday plans in one calm place. Talk to your AI assistant. Watch your progress here.</p>
    <div className="auth-features"><span><Check size={16}/> Private by default</span><span><Check size={16}/> Built for two</span><span><Check size={16}/> Works across devices</span></div>
    <button className="primary-btn google-button" disabled={busy} onClick={googleLogin}>{busy?<LoaderCircle className="spin" size={18}/>:<span className="google-letter">G</span>} Continue with Google <ArrowRight size={18}/></button>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="auth-foot">Secured by Supabase Authentication</div>
  </section></main>;

  return <div className="app-shell">
    <aside className={'sidebar'+(mobileMenu?' mobile-open':'')}>
      <div className="sidebar-brand"><span className="brand-mark"><Sparkles size={18}/></span><div><strong>Personal Hub</strong><small>Your own little space</small></div><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <nav className="side-nav"><button className={activeView==='overview'?'selected':''} onClick={()=>{setActiveView('overview');setMobileMenu(false);}}><LayoutDashboard size={18}/> Overview</button><div className="nav-header">YOUR PROJECTS <button title="New project" onClick={()=>{setProjectModal(true);setMobileMenu(false);}}><Plus size={17}/></button></div>
      {projects.length===0 && <span className="empty-sidebar">No projects yet</span>}
      {projects.map(p=><button key={p.id} className={activeView==='project'&&p.id===projectId?'selected':''} onClick={()=>openProject(p)}><span className="nav-dot"/>{p.name}<ChevronRight size={16} className="push-right"/></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="avatar">{(user.email||'U')[0].toUpperCase()}</div><div className="account-info"><strong>{user.user_metadata?.full_name || 'My account'}</strong><span>{user.email}</span></div><button className="icon-btn" onClick={signout} title="Sign out"><LogOut size={19}/></button></div>
    </aside>
    {mobileMenu&&<button className="mobile-overlay" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu-btn icon-btn" onClick={()=>setMobileMenu(true)}><Folder size={20}/></button><div className="crumb">Personal Hub <ChevronRight size={15}/> <strong>{activeView==='overview'?'Overview':currentProject?.name || 'Project'}</strong></div><div className="top-actions"><button className="ghost-btn" onClick={()=>void load()} title="Refresh" disabled={loading}><RefreshCw size={17} className={loading?'spin':''}/><span>Refresh</span></button><div className="top-avatar">{(user.email||'U')[0].toUpperCase()}</div></div></header>
      <div className="content-wrapper">
        {error && <div className="error error-banner" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {activeView==='overview' ? <>
          <div className="hero-section"><div className="eyebrow">YOUR PERSONAL COMMAND CENTER</div><h1>Keep things moving<span className="dot-accent">.</span></h1><p>A simple place for everything you and Komal are working toward.</p><button className="primary-btn" onClick={()=>setProjectModal(true)}><Plus size={18}/> New project</button></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon purple"><Folder size={20}/></div><span>Projects</span><strong>{projects.length}</strong><small>All your plans</small></div>
            <div className="stat-card"><div className="stat-icon teal"><ClipboardList size={20}/></div><span>Open tasks</span><strong>{totals.open}</strong><small>Things to work on</small></div>
            <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={20}/></div><span>Completed</span><strong>{totals.completed}</strong><small>Out of {totals.all} tasks</small></div>
          </div>
          <div className="section-heading"><div><div className="eyebrow">IN PROGRESS</div><h2>Your projects</h2></div><span className="muted-small">{projects.length} total</span></div>
          {projects.length ? <div className="projects-grid">{projects.map((p,i)=><button key={p.id} className="project-card" onClick={()=>openProject(p)}><div className="project-top"><div className={'project-icon tone-'+i%4}>{projectMonogram(p.name)}</div><ChevronRight size={20}/></div><strong>{p.name}</strong><p>{p.description||'Organize everything in one place.'}</p><div className="progress-info"><span>Progress</span><b>{progressFor(p.id)}%</b></div><div className="progress-track"><div style={{width:progressFor(p.id)+'%'}}/></div><div className="project-meta"><span><CalendarDays size={14}/>{p.target_date?prettyDate(p.target_date):'No end date'}</span><span>{tasks.filter(t=>t.project_id===p.id).length} tasks</span></div></button>)}</div> : <div className="blank"><Target size={27}/><h3>Start your first project</h3><p>Japan plans, wedding checklist, or anything on your mind.</p><button className="primary-btn" onClick={()=>setProjectModal(true)}><Plus size={18}/> Create project</button></div>}
          {nextTasks.length>0&&<><div className="section-heading gap-top"><div><div className="eyebrow">STAY ON TRACK</div><h2>Up next</h2></div></div><div className="task-list">{nextTasks.map(t=><div className="task-row" key={t.id}><button title="Mark completed" className="task-checkbox" disabled={busy} onClick={()=>void toggleTask(t)}><Circle size={20}/></button><div className="task-body"><strong>{t.title}</strong><small>{projects.find(p=>p.id===t.project_id)?.name||'Project'}</small></div><span className="date-label">{prettyDate(t.due_at)}</span></div>)}</div></>}
        </> : <>
          {currentProject ? <><div className="project-header"><div><div className="eyebrow">PROJECT / {currentProject.status.toUpperCase()}</div><h1>{currentProject.name}<span className="dot-accent">.</span></h1><p>{currentProject.description||'Everything for this project, in one place.'}</p></div><button className="primary-btn" onClick={()=>setTaskModal(true)}><Plus size={18}/> Add task</button></div>
            <div className="project-summary"><div><div className="muted-small">PROGRESS</div><strong>{progressFor(currentProject.id)}%</strong></div><div className="wide-progress"><div className="progress-track"><div style={{width:progressFor(currentProject.id)+'%'}}/></div><small>{filteredTasks.filter(t=>t.status==='done').length} of {filteredTasks.length} tasks completed</small></div><div className="summary-date"><CalendarDays size={18}/>{currentProject.target_date?prettyDate(currentProject.target_date):'No deadline'}</div></div>
            <div className="section-heading"><div><div className="eyebrow">ACTION ITEMS</div><h2>Tasks</h2></div><span className="muted-small">{filteredTasks.length} total</span></div>
            {filteredTasks.length>0 ? <div className="task-list">{filteredTasks.map(t=><div className={'task-row'+(t.status==='done'?' done':'')} key={t.id}><button className="task-checkbox" title={t.status==='done'?'Mark incomplete':'Mark complete'} disabled={busy} onClick={()=>void toggleTask(t)}>{t.status==='done'?<CheckCircle2 size={23}/>:<Circle size={23}/>}</button><div className="task-body"><strong>{t.title}</strong><small>{t.status.replace('_',' ')} · <span className={'priority '+t.priority}>{t.priority}</span></small></div><span className="date-label">{prettyDate(t.due_at)}</span><button className="icon-btn task-trash" title="Delete task" disabled={busy} onClick={()=>void deleteTask(t)}><Trash2 size={17}/></button></div>)}</div> : <div className="blank"><ClipboardList size={27}/><h3>No tasks yet</h3><p>Create a checklist and watch your progress update.</p><button className="primary-btn" onClick={()=>setTaskModal(true)}><Plus size={18}/> Add first task</button></div>}
          </>:<div className="blank">Choose a project from the sidebar.</div>}
        </>}
      </div>
    </main>
    {projectModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectModal(false)}}><form className="modal-card" onSubmit={createProject}><div className="modal-title"><div><span className="eyebrow">PERSONAL HUB</span><h2>New project</h2></div><button className="icon-btn" type="button" onClick={()=>setProjectModal(false)}><X size={20}/></button></div><label>Project name<input autoFocus maxLength={200} placeholder="e.g. Japan Trip" required value={projectName} onChange={e=>setProjectName(e.target.value)}/></label><label>Description (optional)<textarea rows={3} value={projectDesc} placeholder="What is this project about?" onChange={e=>setProjectDesc(e.target.value)}/></label><div className="modal-actions"><button className="ghost-btn" type="button" onClick={()=>setProjectModal(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={busy||!projectName.trim()}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={17}/>} Create project</button></div></form></div>}
    {taskModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setTaskModal(false)}}><form className="modal-card" onSubmit={createTask}><div className="modal-title"><div><span className="eyebrow">{currentProject?.name.toUpperCase()}</span><h2>New task</h2></div><button className="icon-btn" type="button" onClick={()=>setTaskModal(false)}><X size={20}/></button></div><label>Task name<input autoFocus maxLength={300} placeholder="e.g. Submit visa documents" required value={newTask.title} onChange={e=>setNewTask(s=>({...s,title:e.target.value}))}/></label><div className="form-row"><label>Priority<select value={newTask.priority} onChange={e=>setNewTask(s=>({...s,priority:e.target.value as Task['priority']}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input type="date" value={newTask.due} onChange={e=>setNewTask(s=>({...s,due:e.target.value}))}/></label></div><div className="modal-actions"><button className="ghost-btn" type="button" onClick={()=>setTaskModal(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={busy||!newTask.title.trim()}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={17}/>} Add task</button></div></form></div>}
  </div>;
}
