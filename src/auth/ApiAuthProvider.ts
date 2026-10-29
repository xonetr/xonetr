import type {AuthProvider,AuthSession} from "./AuthProvider";

async function request(path:string,options:RequestInit={}){
  const response=await fetch(path,{credentials:"include",...options,headers:options.headers});
  if(response.ok)return response.json();
  let detail="No se pudo completar la operación.";
  try{detail=(await response.json()).detail??detail}catch{}
  throw new Error(detail);
}

export class ApiAuthProvider implements AuthProvider{
  async login(email:string,password:string){return request("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}) as Promise<AuthSession>}
  async logout(){await request("/api/auth/logout",{method:"POST"})}
  async getSession(){
    try{return await request("/api/auth/session") as AuthSession}catch{return null}
  }
}
