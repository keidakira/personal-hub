'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, ClipboardList, Folder, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, Sparkles, Sun, Menu, Target, Flag, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

import type { Project, Task, Milestone, NewTask } from '@/lib/types';
import { taskProgress } from '@/lib/progress';
import { MilestoneBoard, prettyDate, ProgressBar, ProjectCard, TaskList, TodaySection } from './components/progress-views';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [taskModal, setTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>({title:'', priority:'medium', due:'', milestone:''});
  const [activeView, setActiveView] = useState<'overview'|'project'>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [taskFilter, setTaskFilter] = useState<'all'|'open'|'done'>('all');

  useEffect(() => {
    if (!projectModal && !taskModal && !milestoneModal && !mobileMenu) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProjectModal(false); setTaskModal(false); setMilestoneModal(false); setMobileMenu(false);
      }
      if (event.key === 'Tab') {
        const container = document.querySelector(projectModal || taskModal || milestoneModal ? '.modal-card' : '.sidebar');
        const controls = container?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    if (mobileMenu) document.querySelector<HTMLElement>('.mobile-close')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [projectModal, taskModal, milestoneModal, mobileMenu]);

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    const [pr, ta, mi] = await Promise.all([
      supabase.from('projects').select('id,name,description,status,target_date,created_at').order('created_at',{ascending:false}),
      supabase.from('tasks').select('id,project_id,title,description,status,priority,due_at,parent_task_id,assigned_to,created_at,milestone_id').order('created_at',{ascending:true}),
      supabase.from('milestones').select('id,project_id,title,created_at').order('created_at',{ascending:true}).order('id',{ascending:true}),
    ]);
    if (pr.error || ta.error || mi.error) setError(pr.error?.message || ta.error?.message || mi.error?.message || 'Could not load projects.');
    else {
      setProjects(pr.data as Project[]);
      setTasks(ta.data as Task[]);
      setMilestones(mi.data as Milestone[]);
      setProjectId(old => old && pr.data.some(p=>p.id===old) ? old : (pr.data[0]?.id ?? null));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) { void load(); } else { setProjects([]);setTasks([]);setMilestones([]);setSelectedMilestone(null);setProjectId(null); } }, [user,load]);

  const currentProject = projects.find(p=>p.id===projectId) ?? null;
  const filteredTasks = tasks.filter(t=>t.project_id===projectId);
  const projectMilestones = milestones.filter(m=>m.project_id===projectId);
  const selectedStage = projectMilestones.find(m=>m.id===selectedMilestone);
  const scopedTasks = selectedStage ? filteredTasks.filter(t=>t.milestone_id===selectedStage.id) : filteredTasks;
  const visibleTasks = scopedTasks.filter(t => taskFilter === 'all' || (taskFilter === 'done' ? t.status === 'done' : t.status !== 'done'));
  const progress = taskProgress(filteredTasks);
  const totals = useMemo(()=>({all:tasks.length,completed:tasks.filter(t=>t.status==='done').length,open:tasks.filter(t=>t.status!=='done').length}),[tasks]);

  function openNewTask() {
    setNewTask({title:'', priority:'medium', due:'', milestone:selectedStage?.id || ''});
    setTaskModal(true);
  }

  async function createMilestone(e: FormEvent) {
    e.preventDefault();
    if (!user || !projectId || !milestoneTitle.trim()) return;
    setBusy(true); setError('');
    const { data, error: err } = await supabase.from('milestones').insert({project_id:projectId, title:milestoneTitle.trim(), created_by:user.id}).select('id,project_id,title,created_at').single();
    if (err) setError(err.message);
    else {
      setMilestones(old=>[...old, data as Milestone]); setMilestoneTitle(''); setMilestoneModal(false);
      setNotice('Milestone added. Assign tasks using the milestone menu beside each task.');
    }
    setBusy(false);
  }

  async function assignMilestone(task: Task, milestoneId: string) {
    setBusy(true); setError('');
    const {data, error:err} = await supabase.from('tasks').update({milestone_id:milestoneId || null,change_source:'app'}).eq('id',task.id).eq('project_id',task.project_id).select('id,milestone_id').single();
    if (err) setError(err.message);
    else { setTasks(old=>old.map(t=>t.id===data.id?{...t,milestone_id:data.milestone_id}:t)); setNotice('Task milestone updated.'); }
    setBusy(false);
  }

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
    else {setProjectName('');setProjectDesc('');setProjectModal(false);await load();setProjectId(data.id);setSelectedMilestone(null);setTaskFilter('all');setActiveView('project');}
    setBusy(false);
  }
  async function createTask(e: FormEvent) {
    e.preventDefault(); if (!user || !projectId || !newTask.title.trim()) return;
    setBusy(true); setError('');
    const {error:err} = await supabase.from('tasks').insert({
      project_id:projectId,title:newTask.title.trim(),priority:newTask.priority,
      due_at:newTask.due ? new Date(newTask.due+'T18:00:00').toISOString() : null,
      status:'todo',created_by:user.id,milestone_id:newTask.milestone || null,
    });
    if (err) setError(err.message);
    else {setNewTask({title:'',priority:'medium',due:'',milestone:''});setTaskModal(false);await load();}
    setBusy(false);
  }
  async function toggleTask(task: Task) {
    setBusy(true); setError('');
    const {error:err}=await supabase.from('tasks').update({status:task.status==='done'?'todo':'done',change_source:'app'}).eq('id',task.id).select('id,status').single();
    if (err) setError(err.message); else { await load(); setNotice(task.status==='done'?'Task reopened. One step at a time.':'A little closer. Task completed.'); }
    setBusy(false);
  }
  async function deleteTask(task: Task) {
    if (!confirm(`Delete task “${task.title}”?`)) return;
    setBusy(true);setError('');
    const {error:err}=await supabase.from('tasks').delete().eq('id',task.id);
    if (err) setError(err.message); else await load();
    setBusy(false);
  }
  function openProject(p: Project) {setSelectedMilestone(null);setTaskFilter('all');setProjectId(p.id);setActiveView('project');setMobileMenu(false);window.scrollTo({top:0});}

  if (!authChecked) return <div className="center-page"><LoaderCircle className="spin" size={30}/><p>Connecting to Personal Hub…</p></div>;
  if (!user) return <main className="auth-layout"><div className="auth-wordmark"><span className="brand-mark"><Sparkles size={18}/></span> Personal Hub</div><section className="auth-box">
    <div className="brand-pill"><span className="brand-mark"><Sparkles size={18}/></span> Personal Hub</div>
    <div className="auth-overline">A LITTLE SPACE. A CLEARER MIND.</div>
    <h1>Life, a little<br/><em>more together.</em></h1>
    <p>Big plans. Everyday to-dos. Keep everything you’re working toward in one thoughtful, peaceful place.</p>
    <div className="auth-features"><span><Check size={16}/> Private by default</span><span><Check size={16}/> Built for two</span><span><Check size={16}/> Works across devices</span></div>
    <button className="primary-btn google-button" disabled={busy} onClick={googleLogin}>{busy?<LoaderCircle className="spin" size={18}/>:<span className="google-letter">G</span>} Continue with Google <ArrowRight size={18}/></button>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="auth-foot">Your plans are personal. Your space is private.</div>
  </section><aside className="auth-preview" aria-label="A calmer way to plan"><div className="preview-note"><span className="preview-kicker">LESS NOISE, MORE LIFE</span><h2>For the things<br/>that matter.</h2><p>A little clarity goes a long way.</p></div><div className="preview-paper"><div className="preview-paper-top"><span className="preview-icon"><Sun size={24}/></span><span>YOUR EVERYDAY, ORGANIZED</span></div><h3>A little room to grow</h3><p>Good things start with a simple plan.</p><div className="preview-task"><CheckCircle2 size={18}/><s>Dream up something wonderful</s></div><div className="preview-task"><Circle size={18}/> Make space for what’s next</div><div className="preview-task"><Circle size={18}/> Enjoy the little things</div><div className="preview-footer"><span className="preview-avatars"><b>N</b><b>K</b></span> Better, together.<span>✧</span></div></div><span className="auth-preview-foot">A home for your plans, and the people in them.</span></aside></main>;

  return <div className="app-shell">
    <aside className={'sidebar'+(mobileMenu?' mobile-open':'')}>
      <div className="sidebar-brand"><span className="brand-mark"><Sparkles size={18}/></span><div><strong>Personal Hub</strong><small>A little more together</small></div><button aria-label="Close navigation" className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <nav className="side-nav"><button className={activeView==='overview'?'selected':''} onClick={()=>{setActiveView('overview');setMobileMenu(false);window.scrollTo({top:0});}}><LayoutDashboard size={18}/> Overview</button><div className="nav-header">YOUR PROJECTS <button title="New project" onClick={()=>{setProjectModal(true);setMobileMenu(false);}}><Plus size={17}/></button></div>
      {projects.length===0 && <span className="empty-sidebar">No projects yet</span>}
      {projects.map(p=><button key={p.id} className={activeView==='project'&&p.id===projectId?'selected':''} onClick={()=>openProject(p)}><span className="nav-dot"/>{p.name}<ChevronRight size={16} className="push-right"/></button>)}
      </nav>
      <div className="sidebar-bottom"><div className="avatar">{(user.email||'U')[0].toUpperCase()}</div><div className="account-info"><strong>{user.user_metadata?.full_name || 'My account'}</strong><span>{user.email}</span></div><button className="icon-btn" onClick={signout} title="Sign out"><LogOut size={19}/></button></div>
    </aside>
    {mobileMenu&&<button className="mobile-overlay" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
    <main className="main-content">
      <header className="topbar"><button aria-label="Open navigation" className="mobile-menu-btn icon-btn" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><div className="crumb">Personal Hub <ChevronRight size={15}/> <strong>{activeView==='overview'?'Overview':currentProject?.name || 'Project'}</strong></div><div className="top-actions"><button className="ghost-btn" onClick={()=>void load()} title="Refresh" disabled={loading}><RefreshCw size={17} className={loading?'spin':''}/><span>Refresh</span></button><div className="top-avatar">{(user.email||'U')[0].toUpperCase()}</div></div></header>
      <div className="content-wrapper">
        {error && <div className="error error-banner" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {loading && projects.length===0 ? <div className="workspace-loading" role="status"><LoaderCircle className="spin" size={22}/> Bringing your plans together…</div> : activeView==='overview' ? <>
          <div className="hero-section"><div className="hero-date">{now.toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'})}</div><div className="eyebrow">YOUR SPACE, AT YOUR PACE</div><div className="page-icon"><Sun size={31} strokeWidth={1.5}/></div><h1>A little more together<span className="dot-accent">.</span></h1><p>Big plans and little steps. It all comes together here.</p><button className="primary-btn hero-create" onClick={()=>setProjectModal(true)}><Plus size={16}/> New project</button></div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon purple"><Folder size={20}/></div><span>Projects</span><strong>{projects.length}</strong><small>All your plans</small></div>
            <div className="stat-card"><div className="stat-icon teal"><ClipboardList size={20}/></div><span>Open tasks</span><strong>{totals.open}</strong><small>Things to work on</small></div>
            <div className="stat-card"><div className="stat-icon green"><CheckCircle2 size={20}/></div><span>Completed</span><strong>{totals.completed}</strong><small>Out of {totals.all} tasks</small></div>
          </div>
          <TodaySection projects={projects} tasks={tasks} now={now} busy={busy} onComplete={task=>void toggleTask(task)} onProject={openProject}/>
          <div className="section-heading"><div><div className="eyebrow">MAKE THINGS HAPPEN</div><h2>Your projects</h2></div><button className="text-btn" onClick={()=>setProjectModal(true)}><Plus size={15}/> New project</button></div>
          {projects.length ? <div className="projects-grid">{projects.map((p,i)=><ProjectCard key={p.id} project={p} index={i} tasks={tasks.filter(t=>t.project_id===p.id)} now={now} onOpen={()=>openProject(p)}/>)}</div> : <div className="blank"><Target size={27}/><h3>Start your first project</h3><p>Japan plans, wedding checklist, or anything on your mind.</p><button className="primary-btn" onClick={()=>setProjectModal(true)}><Plus size={18}/> Create project</button></div>}
        </> : <>
          {currentProject ? <><div className="project-header"><div><div className="eyebrow">PROJECT / {currentProject.status.toUpperCase()}</div><h1>{currentProject.name}<span className="dot-accent">.</span></h1><p>{currentProject.description||'Everything for this project, in one place.'}</p></div><button className="primary-btn" onClick={openNewTask}><Plus size={18}/> Add task</button></div>
            <div className="project-summary"><div><div className="muted-small">PROGRESS</div><strong>{progress.percent}%</strong></div><div className="wide-progress"><ProgressBar completed={progress.completed} total={progress.total} label="Project progress"/><small>{progress.completed} of {progress.total} tasks completed{progress.total>0 && progress.completed===progress.total ? ' · Nicely done!' : ''}</small></div><div className="summary-date"><CalendarDays size={18}/>{prettyDate(currentProject.target_date)}</div></div>
            <MilestoneBoard milestones={projectMilestones} tasks={filteredTasks} selected={selectedStage?.id || null} onSelect={id=>{setSelectedMilestone(id);setTaskFilter('all');}} onAdd={()=>setMilestoneModal(true)}/>
            <div className="section-heading" id="project-tasks"><div><div className="eyebrow">SMALL STEPS, STEADY PROGRESS</div><h2>{selectedStage?.title || 'Tasks'} <span className="heading-count">{scopedTasks.length}</span></h2></div><div className="task-filters" aria-label="Filter tasks">{(['all','open','done'] as const).map(filter=><button key={filter} aria-pressed={taskFilter===filter} className={taskFilter===filter?'active':''} onClick={()=>setTaskFilter(filter)}>{filter==='all'?'All tasks':filter==='open'?'To do':'Completed'}</button>)}</div></div>
            {selectedStage && <div className="active-milestone-filter"><Flag size={12}/><span>Showing {selectedStage.title}</span><button onClick={()=>setSelectedMilestone(null)}>Show all tasks <X size={12}/></button></div>}
            {visibleTasks.length>0 ? <TaskList tasks={visibleTasks} milestones={projectMilestones} busy={busy} now={now} onComplete={task=>void toggleTask(task)} onDelete={task=>void deleteTask(task)} onAssign={(task,id)=>void assignMilestone(task,id)}/> : <div className="blank"><ClipboardList size={27}/><h3>{taskFilter==='done'?'No completed tasks yet':scopedTasks.length ? 'All caught up' : selectedStage ? 'Give this milestone a next step' : 'Every plan starts with a small step'}</h3><p>{taskFilter==='done'?'They’ll appear here as you make progress.':scopedTasks.length?'Enjoy a little breathing room.':selectedStage?'Add a task here, or show all tasks and assign one to this milestone.':'Add your first task and start moving things forward.'}</p>{taskFilter!=='done'&&<button className="primary-btn" onClick={openNewTask}><Plus size={16}/> Add task</button>}</div>}
          </>:<div className="blank">Choose a project from the sidebar.</div>}
        </>}
      </div>
    </main>
    <div className={'completion-notice'+(notice?' visible':'')} role="status" aria-live="polite">{notice&&<><CheckCircle2 size={17}/><span>{notice}</span><button className="icon-btn" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></button></>}</div>
    {milestoneModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setMilestoneModal(false)}}><form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="milestone-dialog-title" onSubmit={createMilestone}><div className="modal-title"><div><span className="eyebrow">A STEPPING STONE</span><h2 id="milestone-dialog-title">New milestone</h2></div><button aria-label="Close dialog" className="icon-btn" type="button" onClick={()=>setMilestoneModal(false)}><X size={20}/></button></div><p className="modal-description">Break {currentProject?.name || 'your project'} into a few meaningful stages. Link tasks to each stage and progress updates as you finish them.</p><label>Milestone name<input autoFocus required maxLength={100} placeholder="e.g. Research, Book, or Get ready" value={milestoneTitle} onChange={e=>setMilestoneTitle(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="ghost-btn" type="button" onClick={()=>setMilestoneModal(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={busy||!milestoneTitle.trim()}>{busy?<LoaderCircle className="spin" size={16}/>:<Flag size={15}/>} Add milestone</button></div></form></div>}
    {projectModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProjectModal(false)}}><form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" onSubmit={createProject}><div className="modal-title"><div><span className="eyebrow">PERSONAL HUB</span><h2 id="project-dialog-title">New project</h2></div><button aria-label="Close dialog" className="icon-btn" type="button" onClick={()=>setProjectModal(false)}><X size={20}/></button></div><label>Project name<input autoFocus maxLength={200} placeholder="e.g. Japan Trip" required value={projectName} onChange={e=>setProjectName(e.target.value)}/></label><label>Description (optional)<textarea rows={3} value={projectDesc} placeholder="What is this project about?" onChange={e=>setProjectDesc(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="ghost-btn" type="button" onClick={()=>setProjectModal(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={busy||!projectName.trim()}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={17}/>} Create project</button></div></form></div>}
    {taskModal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setTaskModal(false)}}><form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onSubmit={createTask}><div className="modal-title"><div><span className="eyebrow">{currentProject?.name.toUpperCase()}</span><h2 id="task-dialog-title">New task</h2></div><button aria-label="Close dialog" className="icon-btn" type="button" onClick={()=>setTaskModal(false)}><X size={20}/></button></div><label>Task name<input autoFocus maxLength={300} placeholder="e.g. Submit visa documents" required value={newTask.title} onChange={e=>setNewTask(s=>({...s,title:e.target.value}))}/></label>{projectMilestones.length>0&&<label>Milestone<select value={newTask.milestone} onChange={e=>setNewTask(s=>({...s,milestone:e.target.value}))}><option value="">No milestone</option>{projectMilestones.map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}<div className="form-row"><label>Priority<select value={newTask.priority} onChange={e=>setNewTask(s=>({...s,priority:e.target.value as Task['priority']}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Due date<input type="date" value={newTask.due} onChange={e=>setNewTask(s=>({...s,due:e.target.value}))}/></label></div>{error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button className="ghost-btn" type="button" onClick={()=>setTaskModal(false)}>Cancel</button><button className="primary-btn" type="submit" disabled={busy||!newTask.title.trim()}>{busy?<LoaderCircle className="spin" size={16}/>:<Plus size={17}/>} Add task</button></div></form></div>}
  </div>;
}
