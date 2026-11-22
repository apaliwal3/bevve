import { matchesContribution, validContributionInput, type ContributionInput, type ContributionRequest, type ContributionResult,
  type SavedBathroomReview, type SavedCrowdReport, type SavedDrinkPrice } from '../../../../shared/contribution-contracts.ts';
import type { accountContributionRepository } from './account-contribution-repository.ts';

export type ContributionOperation = { version: number; request: ContributionRequest | null; saving: boolean; error: boolean; saved: boolean };
export const emptyContributionOperation: ContributionOperation = { version:0,request:null,saving:false,error:false,saved:false };
export const contributionKey = (input: Pick<ContributionInput,'kind'|'barId'>) => `${input.kind}:${input.barId}`;
type Snapshot = {
  status:'loading'|'ready'|'error'; refreshing:boolean; error:boolean;
  crowds:readonly SavedCrowdReport[]; bathrooms:readonly SavedBathroomReview[]; prices:readonly SavedDrinkPrice[];
  operations:Readonly<Record<string,ContributionOperation>>;
};
type Catalog = { venues:readonly {id:string}[]; drinks:readonly {id:string}[]; status:string };
const unique = <T extends {id:string}>(rows:readonly T[]) => [...new Map(rows.map(row=>[row.id,row])).values()];
const sameInput = (a:ContributionInput,b:ContributionInput) => {
  if (a.kind!==b.kind || a.barId!==b.barId) return false;
  if (a.kind==='crowd' && b.kind==='crowd') return a.level===b.level;
  if (a.kind==='price' && b.kind==='price') return a.drinkId===b.drinkId && a.priceCents===b.priceCents;
  return a.kind==='bathroom' && b.kind==='bathroom' && a.cleanliness===b.cleanliness && a.accessibility===b.accessibility && a.wait_time===b.wait_time;
};

export function createAccountContributionStore(userId:string, repository:ReturnType<typeof accountContributionRepository>, nextId:()=>string, onConfirmed:()=>void) {
  let snapshot:Snapshot={status:'loading',refreshing:false,error:false,crowds:[],bathrooms:[],prices:[],operations:{}};
  const initial=snapshot, listeners=new Set<()=>void>();
  let active=false,generation=0,revision=0;
  let catalog:Catalog={venues:[],drinks:[],status:'loading'};
  let loading:Promise<void>|null=null;
  const pending=new Map<string,Promise<void>>();
  const crowds=new Map<string,SavedCrowdReport>(), prices=new Map<string,SavedDrinkPrice>();
  const bathroomWrites=new Map<string,{revision:number;row:SavedBathroomReview}>();
  function publish(patch:Partial<Snapshot>){snapshot={...snapshot,...patch};listeners.forEach(listener=>listener());}
  const operation=(key:string)=>snapshot.operations[key]??emptyContributionOperation;
  function setOperation(key:string,value:ContributionOperation){publish({operations:{...snapshot.operations,[key]:value}});}
  function accept(result:ContributionResult, request:ContributionRequest) {
    if (result.kind==='crowd') {crowds.set(result.row.id,result.row);publish({crowds:unique([...snapshot.crowds,result.row])});}
    if (result.kind==='price') {prices.set(result.row.id,result.row);publish({prices:unique([...snapshot.prices,result.row])});}
    if (result.kind==='bathroom') {
      bathroomWrites.set(result.row.bar_id,{revision:++revision,row:result.row});
      publish({bathrooms:[...snapshot.bathrooms.filter(row=>row.bar_id!==result.row.bar_id),result.row]});
    }
    const key=contributionKey(request.input),current=operation(key);
    if (current.request?.id===request.id) setOperation(key,{version:current.version+1,request:null,saving:false,error:false,saved:true});
    onConfirmed();
  }
  function refresh():Promise<void> {
    if (!active) return Promise.resolve();
    if (loading) return loading;
    const run=generation,beforeWrites=revision;
    publish({refreshing:true});
    loading=repository.load(userId).then(data=>{
      if (!active || run!==generation) return;
      const bathrooms=new Map(data.bathrooms.map(row=>[row.bar_id,row]));
      for(const [id,write] of bathroomWrites) if(write.revision>beforeWrites)bathrooms.set(id,write.row);
      publish({status:'ready',error:false,crowds:unique([...data.crowds,...crowds.values()]),prices:unique([...data.prices,...prices.values()]),bathrooms:[...bathrooms.values()]});
      for(const op of Object.values(snapshot.operations)) {
        if(!op.request) continue;
        const request=op.request;
        const result:ContributionResult|undefined=request.input.kind==='crowd'
          ? snapshot.crowds.filter(row=>row.id===request.id).map(row=>({kind:'crowd' as const,row}))[0]
          : request.input.kind==='price' ? snapshot.prices.filter(row=>row.id===request.id).map(row=>({kind:'price' as const,row}))[0] : undefined;
        if(result && matchesContribution(result,request))accept(result,request);
      }
    }).catch(()=>{
      if(active && run===generation)publish({status:snapshot.status==='ready'?'ready':'error',error:true});
    }).finally(()=>{if(run===generation){loading=null;if(active)publish({refreshing:false});}});
    return loading;
  }
  function send(key:string,request:ContributionRequest):Promise<void> {
    const existing=pending.get(request.id);if(existing)return existing;
    const run=generation;
    setOperation(key,{...operation(key),request,saving:true,error:false,saved:false});
    const promise=repository.save(userId,request).then(result=>{
      if(!active || run!==generation)throw new Error('Account changed');
      if(!matchesContribution(result,request))throw new Error('Mismatched contribution response');
      accept(result,request);
    }).catch(error=>{
      const current=operation(key);
      if(active && run===generation && current.request?.id===request.id)setOperation(key,{...current,saving:false,error:true});
      throw error;
    }).finally(()=>{if(run===generation)pending.delete(request.id);});
    pending.set(request.id,promise);return promise;
  }
  return {
    getSnapshot:()=>snapshot,getServerSnapshot:()=>initial,
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
    setCatalog(value:Catalog){catalog=value;},
    start(){
      active=true;generation++;loading=null;
      publish({operations:Object.fromEntries(Object.entries(snapshot.operations).map(([key,op])=>[key,op.saving?{...op,saving:false,error:true}:op]))});
      void refresh();return()=>{active=false;generation++;loading=null;pending.clear();};
    },
    refresh,
    submit(input:ContributionInput,expectedVersion:number):Promise<void> {
      if(!active || snapshot.status!=='ready' || catalog.status!=='ready' || !validContributionInput(input) ||
        !catalog.venues.some(row=>row.id===input.barId) || (input.kind==='price' && !catalog.drinks.some(row=>row.id===input.drinkId)))
        return Promise.reject(new Error('Contribution unavailable'));
      const key=contributionKey(input),current=operation(key);
      if(current.version!==expectedVersion)return Promise.reject(new Error('Stale contribution action'));
      if(current.request && !sameInput(current.request.input,input))return Promise.reject(new Error('Retry the pending contribution first'));
      return send(key,current.request??{id:nextId(),input:{...input}});
    },
    retry(key:string,requestId:string):Promise<void> {
      const current=operation(key);
      if(!active || !current.request || current.request.id!==requestId)return Promise.reject(new Error('Contribution unavailable'));
      return send(key,current.request);
    },
  };
}
