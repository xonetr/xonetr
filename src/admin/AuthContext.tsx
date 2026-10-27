import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {authProvider,type AuthSession} from "../auth";

type AuthContextValue={session:AuthSession|null;loading:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AdminAuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<AuthSession|null>(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{void authProvider.getSession().then(setSession).finally(()=>setLoading(false))},[]);
  const value=useMemo<AuthContextValue>(()=>({session,loading,async login(email,password){setSession(await authProvider.login(email,password))},async logout(){await authProvider.logout();setSession(null)}}),[session,loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider.");return value}

