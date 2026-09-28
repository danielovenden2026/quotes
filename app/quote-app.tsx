
    
  
'use client';
import QuoteCheckout from './quote-checkout';
import type {CheckoutDetails} from '@/lib/checkout';
import {useEffect,useRef,useState} from 'react';
import {Pencil,RefreshCw,ArrowLeft,ArrowRight,GripVertical,Check,CheckCircle2,ChevronDown,ChevronRight,Copy,Download,ExternalLink,FileText,History,Mail,MapPin,MessageSquare,Minus,Package,Phone,Plus,Search,ShieldCheck,Trash2,Truck,Users,Wrench,X,Link2,Save} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Table,TableHeader,TableHead,TableRow,TableBody,TableCell} from '@/components/ui/table';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Toaster,toast} from 'sonner';
import {australianStates,stateNames,deliveryAddress} from '@/lib/delivery-address';
import HubSpotContactPicker from './hubspot-contact-picker';
import WorkspaceUsers from './workspace-users';
import TwoFactorChallenge from './two-factor-challenge';
import PreparedByFields from './prepared-by-fields';
import {allPermissions,noPermissions,type Permissions} from '@/lib/permissions';
import WorkspaceConnections from './workspace-connections';
import {lineSubtotal,validDiscount} from '@/lib/line-pricing';
import LineDiscountEditor from './line-discount-editor';
import LinePrice from './line-price';
import ExoProductSearch from './exo-product-search';
import QuotesWorkspace from './quotes-workspace';
import FreightCalculator from './freight-calculator';
import UnloadingSelector from './unloading-selector';
import CustomerUnloading from './customer-unloading';
import CustomerQuoteBanner from './customer-quote-banner';
import OptionalCarousel from './optional-carousel';
import {syncAutoOptions} from '@/lib/auto-options';
import {freightNeedsRefresh,freightFingerprint,isFreightOnlyHold} from '@/lib/freight';
import FulfilmentSelector from './fulfilment-selector';
import {fulfilmentCharges} from '@/lib/fulfilment';
import MarginFrame from './margin-frame';
import DemoMargin from './demo-margin';
import {stockFields,stockLabel,type StockLevels} from '@/lib/stock';
import {demoStock} from '@/lib/demo-stock';
import {demoUnitCost,reviewDemoMargins} from '@/lib/demo-margins';
import AdhocForm from './adhoc-form';
import DemoProductForm from './demo-product-form';
import ProductNote from './product-note';
import WorkspaceNumberInput from './workspace-number-input';
import {declineReasons} from '@/lib/decline-reasons';
import ProductGallery from './product-gallery';
import {useStaffColumns} from './staff-columns';
import StaffTableScroll from './staff-table-scroll';
import {createDemoStore} from '@/lib/demo-store';
import {quoteRows,staffQuoteRows,customerQuoteRows,customerQuoteSections,moveQuoteRow,reanchorBlocks,newBlockId,type QuoteBlock} from '@/lib/quote-layout';
import QuoteLayoutRow from './quote-layout-row';
import {QuoteBlockView} from './quote-note';
import {quotePdf} from '@/lib/pdf';
import {browserPdfImages} from '@/lib/pdf-images';
import type {CatalogueResponse} from '@/lib/product-feed';
import {lineKey,type Quote,type Item,catalogue,totals,money,dateLabel,expired,needsReview,needsPrice} from '@/lib/quote';
async function liveApi(url:string,body?:any,method='POST'){const r=await fetch(url,body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const j:any=await r.json();if(!r.ok)throw new Error(j.error||'Unable to connect. Please try again.');return j;}
function ProductImage({item,small=false}:{item:Item;small?:boolean}){const [failed,setFailed]=useState(false);const image=item.image||item.images?.[0]||((item.adhocId||item.custom||item.productSource==='exo')?undefined:catalogue.find(i=>i.sku===item.sku)?.image);useEffect(()=>setFailed(false),[image]);return <div className={'product-image '+(small?'small':'')}>{image&&!failed?<img src={image} alt={item.name} onError={()=>setFailed(true)}/>:<Package aria-hidden="true"/>}</div>;}
function Status({q}:{q:Quote}){return <span className={'status '+q.status.toLowerCase().replaceAll(' ','-')}>{expired(q)&&q.status==='Ready'?'Expired':q.status}</span>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export default function QuoteApp({initialView,initialId,freshSample=false,sharedDemo=false,demoQuote,liveDemoData=false,demoPath='/demo/vq-ecbe1bd3',initialGpTarget=40}:{initialView:'staff'|'customer';initialId?:string;freshSample?:boolean;sharedDemo?:boolean;demoQuote?:Quote;liveDemoData?:boolean;demoPath?:string;initialGpTarget?:number}){
const demoStore=useRef<ReturnType<typeof createDemoStore>|null>(null);if(sharedDemo&&!demoStore.current)demoStore.current=createDemoStore(demoQuote);const api=sharedDemo?demoStore.current!.request:liveApi;
const [view,setView]=useState(initialView),[q,setQ]=useState<Quote|null>(null),[saved,setSaved]=useState<Quote|null>(null),[quotes,setQuotes]=useState<Quote[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[modal,setModal]=useState(''),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[acceptName,setAcceptName]=useState(''),[agreed,setAgreed]=useState(false),[reason,setReason]=useState(''),[payment,setPayment]=useState('checkout'),[acceptPo,setAcceptPo]=useState(''),[collapsedExtras,setCollapsedExtras]=useState<Record<string,boolean>>({}),[filter,setFilter]=useState('all');const started=useRef(false);

const [checkoutOpen,setCheckoutOpen]=useState(false);
useEffect(()=>{const sync=()=>setCheckoutOpen(window.location.hash==='#checkout');sync();window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[]);
function openCheckout(){window.history.pushState(null,'',window.location.pathname+window.location.search+'#checkout');setCheckoutOpen(true);window.scrollTo(0,0);}
function closeCheckout(){window.history.replaceState(null,'',window.location.pathname+window.location.search);setCheckoutOpen(false);window.scrollTo(0,0);}
async function saveCheckout(details:CheckoutDetails,refresh:boolean){
 if(!q||busy)return null;setBusy(true);
 try{let next=await api('/api/quotes/'+q.id,{version:q.version,action:'checkout-save',checkout:details},'PATCH');commit(next);
 if(refresh&&next.status==='Ready'){const items=next.items.map(({lineId,sku,qty,selected}:Item)=>({lineId,sku,qty,selected}));const result=sharedDemo?await liveApi((liveDemoData?demoPath:'/demo')+'/freight',{items,shipmentFingerprint:freightFingerprint(next)}):undefined;next=await api('/api/quotes/'+q.id,{version:next.version,action:'customer-freight',items,po:next.po,instructions:next.instructions,fulfilmentMethod:next.fulfilmentMethod,...(result?{freightEstimate:result.freightEstimate}:{})},'PATCH');commit(next);}
 return next as Quote;
 }catch(e:any){toast.error(e.message||'Checkout details could not be saved.');return null;}finally{setBusy(false);}
}
const [freightToolbar,setFreightToolbar]=useState<HTMLSpanElement|null>(null),[freightFeedback,setFreightFeedback]=useState<HTMLDivElement|null>(null);
const freightBaselines=useRef(new Map<string,string>());
const [usersOpen,setUsersOpen]=useState(false);
const [permissions,setPermissions]=useState<Permissions>(sharedDemo?allPermissions:noPermissions),
  [requiresTwoFactor,setRequiresTwoFactor]=useState(false),
  [accessReady,setAccessReady]=useState(sharedDemo),
  [currentUserName,setCurrentUserName]=useState(''),
  [highValueCents,setHighValueCents]=useState(1000000),
  [minimumSavePct,setMinimumSavePct]=useState(20);
const [connectionsOpen,setConnectionsOpen]=useState(false);
const [quotesOpen,setQuotesOpen]=useState(false),[quotesLoading,setQuotesLoading]=useState(false),[quotesError,setQuotesError]=useState('');
const demoImageUrls=useRef<string[]>([]);useEffect(()=>()=>{demoImageUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
const [canViewCosts,setCanViewCosts]=useState(false),[canAddCustom,setCanAddCustom]=useState(false);
const tableView=useStaffColumns(sharedDemo||canViewCosts);
const canReadMetrics=canViewCosts||liveDemoData;const sampleDemo=sharedDemo&&!liveDemoData;const demoMetrics=demoPath+'/metrics/';
const [refreshingMetrics,setRefreshingMetrics]=useState(false);
const [costReady,setCostReady]=useState(false),[costRevision,setCostRevision]=useState(0);
useEffect(()=>{if(sharedDemo){setCanViewCosts(false);setCanAddCustom(false);return;}const controller=new AbortController();fetch('/api/admin/access',{cache:'no-store',signal:controller.signal}).then(async response=>{const result=await response.json() as {requiresTwoFactor?:boolean;canViewCosts?:boolean;canAddCustom?:boolean;permissions?:Permissions;name?:string;highValueCents?:number;minimumSavePct?:number};if(!controller.signal.aborted){setRequiresTwoFactor(result.requiresTwoFactor===true);setAccessReady(response.ok);setPermissions(response.ok&&result.permissions?result.permissions:noPermissions);if(typeof result.name==='string')setCurrentUserName(result.name);if(typeof result.highValueCents==='number')setHighValueCents(result.highValueCents);if(typeof result.minimumSavePct==='number')setMinimumSavePct(result.minimumSavePct);setCanViewCosts(response.ok&&result.canViewCosts===true);setCanAddCustom(response.ok&&result.canAddCustom===true);}}).catch(()=>{if(!controller.signal.aborted){setCanViewCosts(false);setCanAddCustom(false);}});return ()=>controller.abort();},[sharedDemo,costRevision]);
const stockPayload=JSON.stringify((q?.items||[]).filter(i=>!i.adhocId||i.sourceSku).map(i=>i.sku.trim().toUpperCase()).sort());
const [stockResult,setStockResult]=useState<{key:string;values:Record<string,StockLevels>;error:string}>({key:'',values:{},error:''});
useEffect(()=>{
 if(view!=='staff'||sampleDemo||!accessReady)return;
 const controller=new AbortController();setStockResult({key:'',values:{},error:''});
 fetch(liveDemoData?demoMetrics+'stock':'/api/workspace/stock',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"skus":'+stockPayload+'}',cache:'no-store',signal:controller.signal}).then(async response=>{
  const data=await response.json() as {stock?:Record<string,StockLevels>;error?:string};
  if(!controller.signal.aborted)setStockResult({key:stockPayload,values:response.ok?data.stock||{}:{},error:response.ok?'':data.error||'Stock could not be loaded.'});
 }).catch(()=>{if(!controller.signal.aborted)setStockResult({key:stockPayload,values:{},error:'Stock could not be loaded.'});});
 return ()=>controller.abort();
},[stockPayload,view,sampleDemo,canReadMetrics,accessReady,liveDemoData,costRevision]);
function stockValue(item:Item,field:typeof stockFields[number]['key']){
 if(item.adhocId&&!item.sourceSku)return 'N/A';
 if(sampleDemo)return stockLabel(demoStock(item.sku)[field]);
 if(!accessReady)return 'Sign in';
 if(stockResult.key!==stockPayload)return 'Loading…';
 if(stockResult.error)return 'Unavailable';
 return stockLabel(stockResult.values[item.sku.trim().toUpperCase()]?.[field]);
}
const marginItems=(q?.items||[]).map(({lineId,sku,price,discount,qty,optional,selected,autoOptionFor,adhocId,demoCost,demoCostLineId})=>({lineId,sku,price,discount,qty,optional,selected,autoOptionFor,...(sharedDemo?{demoCostLineId}:{}),...(adhocId?{adhocId}:{}),...(sharedDemo&&demoCost!==undefined?{demoCost}:{})}));
const marginPayload=JSON.stringify(marginItems);
const [gpTarget,setGpTarget]=useState(initialGpTarget);
const [marginReady,setMarginReady]=useState(''),[gpStatus,setGpStatus]=useState<{key:string;lowLines:string[];blockedLines:string[];unknownLines:string[];error:string}>({key:'',lowLines:[],blockedLines:[],unknownLines:[],error:''});
useEffect(()=>{
 if(view!=='staff'||sampleDemo||!accessReady)return;
 const controller=new AbortController();
 const timer=setTimeout(()=>{
  fetch(liveDemoData?demoMetrics+'status':'/api/admin/gp-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:marginItems,quoteId:sharedDemo?undefined:q?.id}),cache:'no-store',signal:controller.signal}).then(async response=>{
   const data=await response.json() as {lowLines?:string[];blockedLines?:string[];unknownLines?:string[];minimumSavePct?:number;error?:string;targetPct?:number};
   if(controller.signal.aborted)return;
   if(response.status===401||response.status===403){setCanViewCosts(false);setCostReady(false);}
   if(response.ok){if(typeof data.minimumSavePct==='number')setMinimumSavePct(data.minimumSavePct);if(typeof data.targetPct==='number')setGpTarget(data.targetPct);setCostReady(true);setMarginReady(marginPayload);}
   setGpStatus({key:marginPayload,lowLines:response.ok&&Array.isArray(data.lowLines)?data.lowLines:[],blockedLines:response.ok&&Array.isArray(data.blockedLines)?data.blockedLines:[],unknownLines:response.ok&&Array.isArray(data.unknownLines)?data.unknownLines:[],error:response.ok?'':data.error||'Costs and GP could not be loaded. Use Refresh costs and GP.'});
  }).catch(()=>{if(!controller.signal.aborted)setGpStatus({key:marginPayload,lowLines:[],blockedLines:[],unknownLines:[],error:'Costs and GP could not be loaded. Use Refresh costs and GP.'});});
 },350);
 return ()=>{clearTimeout(timer);controller.abort();};
},[marginPayload,view,sampleDemo,canReadMetrics,accessReady,liveDemoData,costRevision]);
async function retryCosts(){

