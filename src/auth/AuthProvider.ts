export type AuthSession={email:string;signedInAt:string};

export interface AuthProvider{
  login(email:string,password:string):Promise<AuthSession>;
  logout():Promise<void>;
  getSession():Promise<AuthSession|null>;
}

