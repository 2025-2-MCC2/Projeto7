// src/pages/Grupos/Grupos.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Grupos.css';

// =====================================
// LocalStorage (separado + compat)
// =====================================
const LS_KEYS = {
  grupos: 'le_grupos_v2',       // nova chave (fácil de limpar futuramente)
  legacyGrupos: 'grupos',       // compat com telas antigas (AtividadesGrupo)
};

const LS = {
  get(key, fb){ try { const v = localStorage.getItem(key); return v? JSON.parse(v): fb; } catch { return fb; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  migrate(){
    const novo = localStorage.getItem(LS_KEYS.grupos);
    const legado = localStorage.getItem(LS_KEYS.legacyGrupos);
    if (!novo && legado) { try { localStorage.setItem(LS_KEYS.grupos, legado); } catch {} }
  },
  clearOnlyGrupos(){ localStorage.removeItem(LS_KEYS.grupos); },
};

if (typeof window !== 'undefined') {
  window.__LE_CLEAR_GRUPOS__ = () => LS.clearOnlyGrupos();
}

const currency = (v) => (Number(v||0)).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const initials = (name='?') => String(name).trim().split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();

export default function Grupos(){
  const [perfil] = useState(() => { try { return JSON.parse(localStorage.getItem('perfil')) ?? {}; } catch { return {}; } });
  const isStudent = perfil.tipo === 'aluno';
  const isMentor  = perfil.tipo === 'mentor';
  const isAdmin   = perfil.tipo === 'adm';
  const isMentorLike = isMentor || isAdmin;

  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [grupos, setGrupos] = useState([]);

  const [q, setQ] = useState('');
  const [order, setOrder] = useState('recentes'); // recentes | a_z | z_a
  const tabs = ['criar', 'editar'];
  const [aba, setAba] = useState(() => {
    const qs = new URLSearchParams(location.search); const t = qs.get('tab');
    if (tabs.includes(t)) return t; return isStudent ? 'editar' : 'criar';
  });
  useEffect(()=>{ const qs = new URLSearchParams(location.search); const t = qs.get('tab'); if (t && tabs.includes(t) && t !== aba) setAba(t); }, [location.search]);

  useEffect(()=>{
    LS.migrate(); const t = setTimeout(()=>{
      try { const arr = LS.get(LS_KEYS.grupos, LS.get(LS_KEYS.legacyGrupos, [])); setGrupos(Array.isArray(arr) ? arr : []); } catch(e){ setError('Falha ao ler dados locais.'); }
      setLoading(false);
    }, 160); return ()=> clearTimeout(t);
  }, []);

  useEffect(()=>{ try { LS.set(LS_KEYS.grupos, grupos); LS.set(LS_KEYS.legacyGrupos, grupos); } catch{} }, [grupos]);

  const gruposFiltrados = useMemo(()=>{
    let list = [...grupos];
    if (q.trim()) { const s = q.toLowerCase(); list = list.filter(g => g.nome?.toLowerCase().includes(s) || g.mentor?.toLowerCase().includes(s) || (g.membros||[]).some(m => m.nome?.toLowerCase().includes(s) || String(m.ra||'').includes(s))); }
    if (order === 'a_z') list.sort((a,b)=> String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    else if (order === 'z_a') list.sort((a,b)=> String(b.nome).localeCompare(String(a.nome),'pt-BR'));
    else list.sort((a,b)=> Number(b.id)-Number(a.id));
    return list;
  }, [grupos, q, order]);

  // ===== Helpers de status & badges =====
  const getStatusBadges = (g) => {
    const out = [];
    const meta = Number(g.metaArrecadacao||0);
    const prog = Number(g.progressoArrecadacao||0);
    if (meta <= 0) out.push({ type:'neutral', text:'Sem meta' });
    else if (prog >= meta) out.push({ type:'success', text:'Meta concluída' });
    else out.push({ type:'progress', text:`${Math.floor((prog/meta)*100)}% da meta` });
    out.push({ type: g.mentor ? 'mentor' : 'warn', text: g.mentor ? 'Com mentor' : 'Sem mentor' });
    out.push({ type:'info', text:`${(g.membros||[]).length} membro(s)` });
    return out;
  };

  // =========================
  // Criar
  // =========================
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ nome:'', metaArrecadacao:'', metaAlimentos:'' });
  const [createMembers, setCreateMembers] = useState(()=> isStudent ? [{ nome: perfil.nome||'', ra: perfil.ra||'', telefone:'' }] : [{ nome:'', ra:'', telefone:'' }]);
  const [capaUrl, setCapaUrl] = useState('');
  const capaRef = useRef(null);

  const onPickCapa = (e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type?.startsWith('image/')) return setMessage({ type:'error', text:'Selecione uma imagem válida.' }); const rd = new FileReader(); rd.onload = () => setCapaUrl(String(rd.result)); rd.readAsDataURL(f); };
  const removeCapa = () => { setCapaUrl(''); if (capaRef.current) capaRef.current.value = ''; };

  // Colagem de membros (um por linha: Nome;RA;Telefone | Nome,RA | Nome RA)
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const parseLine = (line) => {
    const raw = line.trim(); if (!raw) return null;
    let parts = raw.split(/[;,\t]|\s{2,}/).map(s=>s.trim()).filter(Boolean);
    if (parts.length === 1) {
      // Tenta separar por último espaço (Nome ... RA)
      const m = raw.match(/^(.*)\s+([A-Za-z0-9\-_.]+)$/); if (m) parts = [m[1].trim(), m[2].trim()];
    }
    const [nome, ra, telefone=''] = parts;
    if (!nome || !ra) return null; return { nome, ra, telefone };
  };
  const onPasteMembers = () => {
    const lines = pasteText.split(/\r?\n/); const parsed = [];
    lines.forEach(l=>{ const m = parseLine(l); if (m) parsed.push(m); });
    if (!parsed.length) { setMessage({type:'error', text:'Nenhum membro válido encontrado. Use: Nome;RA;Telefone'}); return; }
    setCreateMembers(prev=>[...prev, ...parsed]); setPasteText(''); setPasteOpen(false);
  };

  const createValid = useMemo(()=>{
    if (!createForm.nome.trim()) return false;
    if (!isStudent && !String(createForm.metaArrecadacao||'').length) return false;
    if (createMembers.some(m => !m.nome?.trim() || !m.ra?.trim())) return false; return true;
  }, [createForm, createMembers, isStudent]);

  const onCreate = (e) => {
    e.preventDefault(); if (!createValid) { setMessage({type:'error', text:'Preencha os campos obrigatórios.'}); return; }
    setCreating(true);
    try {
      const novo = { id: Date.now(), nome: createForm.nome.trim(), metaArrecadacao: isStudent ? 0 : Number(createForm.metaArrecadacao||0), metaAlimentos: isStudent ? '' : (createForm.metaAlimentos||''), membros: createMembers.filter(m => m.nome && m.ra), progressoArrecadacao: 0, inventario: [], mentor: isMentor ? (perfil.nome||'Mentor') : undefined, mentorFotoUrl: isMentor ? (perfil.fotoUrl||'') : undefined, capaDataUrl: capaUrl || undefined };
      setGrupos(prev => [...prev, novo]); setCreateForm({ nome:'', metaArrecadacao:'', metaAlimentos:'' }); setCreateMembers(isStudent ? [{ nome: perfil.nome||'', ra: perfil.ra||'', telefone:'' }] : [{ nome:'', ra:'', telefone:'' }]); removeCapa(); setAba('editar'); setMessage({ type:'success', text:'Grupo criado com sucesso!' }); setTimeout(()=> setMessage(''), 2500);
    } finally { setCreating(false); }
  };

  // =========================
  // Editar/Excluir
  // =========================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ nome:'', metaArrecadacao:'', metaAlimentos:'' });
  const [editMembers, setEditMembers] = useState([{ nome:'', ra:'', telefone:'' }]);
  const [editCapa, setEditCapa] = useState('');
  const editCapaRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open:false, id:null, name:'' });
  const [pasteOpenEdit, setPasteOpenEdit] = useState(false);
  const [pasteTextEdit, setPasteTextEdit] = useState('');

  const startEdit = (g) => { setEditId(g.id); setEditForm({ nome: g.nome||'', metaArrecadacao: String(g.metaArrecadacao ?? ''), metaAlimentos: g.metaAlimentos||'' }); setEditMembers((g.membros?.length ? g.membros : [{ nome:'', ra:'', telefone:'' }]).map(m => ({ ...m, telefone: m.telefone||'' }))); setEditCapa(g.capaDataUrl || ''); window.scrollTo(0,0); };

  const onPickEditCapa = (e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type?.startsWith('image/')) return setMessage({ type:'error', text:'Selecione uma imagem válida.' }); const rd = new FileReader(); rd.onload = () => setEditCapa(String(rd.result)); rd.readAsDataURL(f); };
  const removeEditCapa = () => { setEditCapa(''); if (editCapaRef.current) editCapaRef.current.value = ''; };

  const onPasteMembersEdit = () => {
    const lines = pasteTextEdit.split(/\r?\n/); const parsed = [];
    lines.forEach(l=>{ const m = parseLine(l); if (m) parsed.push(m); });
    if (!parsed.length) { setMessage({type:'error', text:'Nenhum membro válido encontrado.'}); return; }
    setEditMembers(prev=>[...prev, ...parsed]); setPasteTextEdit(''); setPasteOpenEdit(false);
  };

  const onSave = (e) => {
    e.preventDefault(); if (!editId) return; setSaving(true);
    try { setGrupos(g => g.map(x => x.id===editId ? { ...x, nome: editForm.nome.trim(), metaArrecadacao: Number(editForm.metaArrecadacao||0), metaAlimentos: editForm.metaAlimentos||'', membros: isStudent ? editMembers.filter(m => m.nome && m.ra) : x.membros, mentor: isMentor ? (perfil.nome||'Mentor') : x.mentor, mentorFotoUrl: isMentor ? (perfil.fotoUrl||'') : x.mentorFotoUrl, capaDataUrl: editCapa || undefined } : x)); setEditId(null); setMessage({ type:'success', text:'Grupo atualizado.' }); setTimeout(()=> setMessage(''), 2000); } finally { setSaving(false); }
  };

  const askDelete = (g) => setConfirm({ open:true, id:g.id, name:g.nome });
  const doDelete = () => { const id = confirm.id; setConfirm({open:false, id:null, name:''}); if (!id) return; setGrupos(g => g.filter(x => x.id!==id)); if (editId === id) setEditId(null); };

  return (
    <div className="grupos-page-container">
      <div className="grupos-page-header">
        <h1>Grupos</h1>
        <button onClick={() => navigate('/painel')} className="btn-secondary">Voltar ao Painel</button>
      </div>

      {/* Toolbar */}
      <div className="toolbar-row">
        <div className="left">
          <input className="input" type="search" value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nome, mentor ou membro" />
        </div>
        <div className="right">
          <select className="input" value={order} onChange={(e)=>setOrder(e.target.value)}>
            <option value="recentes">Mais recentes</option>
            <option value="a_z">A–Z</option>
            <option value="z_a">Z–A</option>
          </select>
          <div className="tabs">
            <button className={`btn-secondary ${aba==='criar'?'active':''}`} onClick={()=>setAba('criar')}>Criar</button>
            <button className={`btn-secondary ${aba==='editar'?'active':''}`} onClick={()=>setAba('editar')}>Editar</button>
          </div>
        </div>
      </div>

      {error && <p className="message error" role="alert">{String(error)}</p>}
      {message && <p className={`message ${message.type||'success'}`}>{message.text||String(message)}</p>}

      {loading ? (
        <div className="skeleton-list" aria-busy>
          <div className="sk-row"/><div className="sk-row"/><div className="sk-row"/>
        </div>
      ) : (
        <>
          {aba === 'criar' && (
            <div className="form-card">
              <h2>Criar Novo Grupo</h2>
              <form onSubmit={onCreate}>
                <div className="form-group">
                  <label htmlFor="nome">Nome do Grupo</label>
                  <input id="nome" name="nome" type="text" value={createForm.nome} onChange={(e)=>setCreateForm(f=>({...f, nome:e.target.value}))} placeholder="Ex: Campanha de Natal 2025" required />
                </div>

                <div className="form-group">
                  <label>Membros do Grupo</label>
                  {createMembers.map((m, i)=> (
                    <div key={i} className="member-input-group">
                      <input type="text" name="nome" value={m.nome} onChange={(e)=>{ const cp=[...createMembers]; cp[i]={...cp[i], nome:e.target.value}; setCreateMembers(cp); }} placeholder="Nome" required disabled={isStudent && i===0} />
                      <input type="text" name="ra" value={m.ra} onChange={(e)=>{ const cp=[...createMembers]; cp[i]={...cp[i], ra:e.target.value}; setCreateMembers(cp); }} placeholder="RA" required disabled={isStudent && i===0} />
                      <input type="tel" name="telefone" value={m.telefone} onChange={(e)=>{ const cp=[...createMembers]; cp[i]={...cp[i], telefone:e.target.value}; setCreateMembers(cp); }} placeholder="Telefone (opcional)" />
                      {(createMembers.length>1 && !isStudent) && (<button type="button" className="btn-danger-small" title="Remover" onClick={()=>{ const cp=[...createMembers]; cp.splice(i,1); setCreateMembers(cp); }}>X</button>)}
                    </div>
                  ))}
                  <div className="paste-row">
                    <button type="button" className="btn-secondary" onClick={()=> setPasteOpen(o=>!o)}>Colar lista de membros</button>
                    {pasteOpen && (
                      <div className="paste-block">
                        <textarea rows={5} className="input" placeholder="Um por linha. Ex:\nMaria Silva;12345;1199999-0000\nJoão Souza,54321" value={pasteText} onChange={e=>setPasteText(e.target.value)} />
                        <div className="form-actions">
                          <button type="button" className="btn-secondary" onClick={onPasteMembers}>Processar</button>
                          <button type="button" className="btn" onClick={()=>{ setPasteText(''); setPasteOpen(false); }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" className="btn-secondary" onClick={()=> setCreateMembers(prev=>[...prev, {nome:'', ra:'', telefone:''}])}>Adicionar Membro</button>
                </div>

                {!isStudent && (<>
                  <div className="form-group">
                    <label htmlFor="metaArrecadacao">Meta de Arrecadação (R$)</label>
                    <input id="metaArrecadacao" type="number" value={createForm.metaArrecadacao} onChange={(e)=>setCreateForm(f=>({...f, metaArrecadacao:e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="metaAlimentos">Meta de Alimentos (Opcional)</label>
                    <input id="metaAlimentos" type="text" value={createForm.metaAlimentos} onChange={(e)=>setCreateForm(f=>({...f, metaAlimentos:e.target.value}))} placeholder="Ex: 100 cestas básicas" />
                  </div>
                </>)}

                <div className="form-group">
                  <label>Imagem de capa (opcional)</label>
                  {capaUrl ? (
                    <div className="cover-preview">
                      <img src={capaUrl} alt="Capa do grupo" />
                      <button type="button" className="btn-danger" onClick={removeCapa}>Remover capa</button>
                    </div>
                  ) : (
                    <input ref={capaRef} type="file" accept="image/*" onChange={onPickCapa} />
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={creating || !createValid}>{creating? 'Criando…':'Criar Grupo'}</button>
                </div>
              </form>
            </div>
          )}

          {aba === 'editar' && (<>
            <div className="list-card">
              <h2>Grupos Existentes</h2>
              {gruposFiltrados.length === 0 ? (
                <p>{isStudent ? 'Você ainda não faz parte de um grupo.' : 'Nenhum grupo encontrado.'}</p>
              ) : (
                <ul className="grupos-list">
                  {gruposFiltrados.map(g => {
                    const badges = getStatusBadges(g);
                    return (
                      <li key={g.id} className="grupo-item">
                        <div className="grupo-cover">
                          {g.capaDataUrl ? <img src={g.capaDataUrl} alt="Capa do grupo"/> : <div className="cover-ph">Sem capa</div>}
                        </div>
                        <div className="grupo-info">
                          <div className="title-row">
                            <h3>{g.nome}</h3>
                            <div className="mentor-pill" title={g.mentor?`Mentor: ${g.mentor}`:'Sem mentor'}>
                              {g.mentorFotoUrl ? (
                                <img src={g.mentorFotoUrl} alt="Foto do mentor" className="mentor-avatar" />
                              ) : (
                                <span className="mentor-avatar initials">{g.mentor? initials(g.mentor): '—'}</span>
                              )}
                              <span className="mentor-name">{g.mentor || 'Sem mentor'}</span>
                            </div>
                          </div>
                          <div className="badges">
                            {badges.map((b,i)=>(<span key={i} className={`chip chip-${b.type}`}>{b.text}</span>))}
                          </div>
                          <p>Meta: {currency(g.metaArrecadacao)} · Arrecadado: {currency(g.progressoArrecadacao)}</p>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${Math.min(((g.progressoArrecadacao||0)/(g.metaArrecadacao||1))*100, 100)}%` }} />
                          </div>
                          {g.membros?.length>0 && (
                            <div className="member-list">
                              <strong>Membros:</strong>
                              <ul>{g.membros.map((m,i)=> (<li key={i}>{m.nome} ({m.ra}){m.telefone? ` - ${m.telefone}`:''}</li>))}</ul>
                            </div>
                          )}
                        </div>
                        <div className="grupo-actions" style={{display:'flex', flexDirection:'column', gap:8}}>
                          {((!isStudent) || (isStudent && (g.membros||[]).some(m => String(m.ra)===String(perfil.ra)))) && (<button onClick={()=> startEdit(g)}>Editar</button>)}
                          <button onClick={()=> navigate(`/grupos/atividade/${g.id}`)} className="btn-secondary">Atividades</button>
                          {isMentorLike && (<button onClick={()=> askDelete(g)} className="btn-danger">Excluir</button>)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {editId && (
              <div className="form-card" style={{marginTop:16}}>
                <h2>Editar Grupo</h2>
                <form onSubmit={onSave}>
                  <div className="form-group">
                    <label htmlFor="enome">Nome do Grupo</label>
                    <input id="enome" type="text" value={editForm.nome} onChange={(e)=>setEditForm(f=>({...f, nome:e.target.value}))} required />
                  </div>

                  <div className="form-group">
                    <label>Membros do Grupo</label>
                    {editMembers.map((m, i)=> (
                      <div key={i} className="member-input-group">
                        <input type="text" value={m.nome} onChange={(e)=>{ const cp=[...editMembers]; cp[i]={...cp[i], nome:e.target.value}; setEditMembers(cp); }} placeholder="Nome" required disabled={!isStudent || i===0? !isStudent : false} />
                        <input type="text" value={m.ra} onChange={(e)=>{ const cp=[...editMembers]; cp[i]={...cp[i], ra:e.target.value}; setEditMembers(cp); }} placeholder="RA" required disabled={!isStudent || i===0? !isStudent : false} />
                        <input type="tel" value={m.telefone} onChange={(e)=>{ const cp=[...editMembers]; cp[i]={...cp[i], telefone:e.target.value}; setEditMembers(cp); }} placeholder="Telefone (opcional)" disabled={!isStudent} />
                        {(editMembers.length>1 && !isStudent) && (<button type="button" className="btn-danger-small" title="Remover" onClick={()=>{ const cp=[...editMembers]; cp.splice(i,1); setEditMembers(cp); }}>X</button>)}
                      </div>
                    ))}
                    {isStudent && (<button type="button" className="btn-secondary" onClick={()=> setEditMembers(prev=>[...prev, {nome:'', ra:'', telefone:''}])}>Adicionar Membro</button>)}
                    <div className="paste-row">
                      <button type="button" className="btn-secondary" onClick={()=> setPasteOpenEdit(o=>!o)}>Colar lista de membros</button>
                      {pasteOpenEdit && (
                        <div className="paste-block">
                          <textarea rows={5} className="input" placeholder="Um por linha. Ex:\nMaria Silva;12345;1199999-0000\nJoão Souza 54321" value={pasteTextEdit} onChange={e=>setPasteTextEdit(e.target.value)} />
                          <div className="form-actions">
                            <button type="button" className="btn-secondary" onClick={onPasteMembersEdit}>Processar</button>
                            <button type="button" className="btn" onClick={()=>{ setPasteTextEdit(''); setPasteOpenEdit(false); }}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isStudent && (<>
                    <div className="form-group">
                      <label htmlFor="emeta">Meta de Arrecadação (R$)</label>
                      <input id="emeta" type="number" value={editForm.metaArrecadacao} onChange={(e)=>setEditForm(f=>({...f, metaArrecadacao:e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="emetaAl">Meta de Alimentos (Opcional)</label>
                      <input id="emetaAl" type="text" value={editForm.metaAlimentos} onChange={(e)=>setEditForm(f=>({...f, metaAlimentos:e.target.value}))} />
                    </div>
                  </>)}

                  <div className="form-group">
                    <label>Imagem de capa</label>
                    {editCapa ? (
                      <div className="cover-preview">
                        <img src={editCapa} alt="Capa do grupo" />
                        <button type="button" className="btn-danger" onClick={removeEditCapa}>Remover capa</button>
                      </div>
                    ) : (
                      <input ref={editCapaRef} type="file" accept="image/*" onChange={onPickEditCapa} />
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>{saving? 'Salvando…':'Salvar Alterações'}</button>
                    <button type="button" className="btn-secondary" onClick={()=> setEditId(null)}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}
          </>)}
        </>
      )}

      {confirm.open && (
        <div className="modal-overlay" onClick={()=> setConfirm({open:false,id:null,name:''})}>
          <div className="modal" onClick={(e)=> e.stopPropagation()}>
            <div className="modal-header">
              <h3>Excluir grupo</h3>
              <button className="btn btn-ghost" onClick={()=> setConfirm({open:false,id:null,name:''})}>✕</button>
            </div>
            <div className="modal-body">Tem certeza que deseja excluir o grupo <strong>{confirm.name}</strong>? Esta ação não pode ser desfeita.</div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={()=> setConfirm({open:false,id:null,name:''})}>Cancelar</button>
              <button className="btn btn-danger" onClick={doDelete}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
