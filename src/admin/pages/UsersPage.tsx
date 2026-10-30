import {useEffect,useState,type FormEvent} from "react";
import {Toast} from "../components/Toast";

type ManagedUser={
  id:string;
  name:string;
  email:string;
  role:string;
  active:boolean;
  is_root:boolean;
  created_at:string;
};

async function api(path:string,options:RequestInit={}){
  const response=await fetch(path,{credentials:"include",...options,headers:options.headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(body?.detail??"No se pudo completar la operación.");
  return body as any;
}

const defaultForm={name:"",email:"",password:"",role:"viewer" as "admin"|"developer"|"viewer"};

export function UsersPage(){
  const [items,setItems]=useState<ManagedUser[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [form,setForm]=useState(defaultForm);
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    setLoading(true);
    setError("");
    try {
      const result=await api("/api/users");
      setItems(Array.isArray(result)?result:[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{void load();},[]);

  const onSubmit=async(event:FormEvent)=>{
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/users", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form),
      });
      setForm(defaultForm);
      setToast("Usuario creado correctamente.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el usuario.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="admin-tool-page">
    <header className="admin-tool-heading">
      <div>
        <p className="admin-kicker">// ACCESO</p>
        <h2>Usuarios del panel</h2>
        <p>El administrador raíz permanece protegido y puede crear cuentas para administrar licencias, operaciones y equipo.</p>
      </div>
    </header>

    <section className="admin-panel-card">
      <div className="admin-panel-card__heading">
        <div>
          <p className="admin-kicker">// CREAR</p>
          <h2>Registrar nueva cuenta</h2>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="admin-field">
          <div className="admin-field__heading"><label htmlFor="user-name">Nombre</label></div>
          <input id="user-name" value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))} required />
        </div>

        <div className="admin-field">
          <div className="admin-field__heading"><label htmlFor="user-email">Correo</label></div>
          <input id="user-email" type="email" value={form.email} onChange={event=>setForm(current=>({...current,email:event.target.value}))} required />
        </div>

        <div className="admin-field">
          <div className="admin-field__heading"><label htmlFor="user-password">Contraseña</label></div>
          <input id="user-password" type="password" minLength={6} value={form.password} onChange={event=>setForm(current=>({...current,password:event.target.value}))} required />
        </div>

        <div className="admin-field">
          <div className="admin-field__heading"><label htmlFor="user-role">Rol</label></div>
          <select id="user-role" value={form.role} onChange={event=>setForm(current=>({...current,role:event.target.value as typeof current.role}))}>
            <option value="viewer">Viewer</option>
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button className="admin-button admin-button--primary" type="submit" disabled={busy}>{busy?"Creando…":"Crear usuario"}</button>
      </form>

      {error && <div className="admin-inline-error" role="alert"><span>{error}</span></div>}
    </section>

    <section className="admin-panel-card">
      <div className="admin-panel-card__heading">
        <div>
          <p className="admin-kicker">// LISTA</p>
          <h2>Usuarios activos</h2>
        </div>
      </div>

      {loading ? <p>Cargando usuarios…</p> : items.length === 0 ? <div className="admin-empty"><span aria-hidden="true">＋</span><p>No hay usuarios activos.</p></div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user)=>(
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    {user.is_root && <small style={{display:"block",marginTop:"4px",color:"var(--accent)"}}>Root</small>}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.is_root ? "Inmutable" : user.active ? "Activo" : "Inactivo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>

    <Toast message={toast}/>
  </div>;
}
