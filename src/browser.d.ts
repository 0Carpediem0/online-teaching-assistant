declare const chrome: {
 runtime: {onMessage: {addListener(cb:(m:{type?:string;command?:string;value?:boolean},sender:unknown,reply:(value:unknown)=>void)=>void|boolean):void}};
 tabs: {
  query(options:{active:boolean;currentWindow:boolean}):Promise<Array<{id?:number}>>;
  sendMessage(id:number,message:{type:string;command:string;value?:boolean},options:{frameId:number}):Promise<unknown>;
 };
};
