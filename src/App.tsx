import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import './MobileUx.css'
import { AppErrorBoundary } from './AppErrorBoundary'
import { AppRoleProvider, canViewAudit, type AppRole } from './auth/AppRoleContext'
import { type LiveSession } from './data/liveAudit'
import { AuthGate } from './auth/AuthGate'
import { PwaStatus } from './PwaStatus'

const A4PrintCenter = lazy(() => import('./A4PrintCenter').then((module) => ({ default: module.A4PrintCenter })))
const LiveAuditPanel = lazy(() => import('./LiveAuditPanel').then((module) => ({ default: module.LiveAuditPanel })))
const LiveCalibrationEvaluationPanel = lazy(() => import('./LiveCalibrationEvaluationPanel').then((module) => ({ default: module.LiveCalibrationEvaluationPanel })))
const LiveCalibrationPanel = lazy(() => import('./LiveCalibrationPanel').then((module) => ({ default: module.LiveCalibrationPanel })))
const LiveCalibrationQuotePanel = lazy(() => import('./LiveCalibrationQuotePanel').then((module) => ({ default: module.LiveCalibrationQuotePanel })))
const LiveDashboardPanel = lazy(() => import('./LiveDashboardPanel').then((module) => ({ default: module.LiveDashboardPanel })))
const LiveDowntimePanel = lazy(() => import('./LiveDowntimePanel').then((module) => ({ default: module.LiveDowntimePanel })))
const LiveEquipmentPanel = lazy(() => import('./LiveEquipmentPanel').then((module) => ({ default: module.LiveEquipmentPanel })))
const LiveEquipmentRegistrationPanel = lazy(() => import('./LiveEquipmentRegistrationPanel').then((module) => ({ default: module.LiveEquipmentRegistrationPanel })))
const LiveHandoverPanel = lazy(() => import('./LiveHandoverPanel').then((module) => ({ default: module.LiveHandoverPanel })))
const LiveInspectionPanel = lazy(() => import('./LiveInspectionPanel').then((module) => ({ default: module.LiveInspectionPanel })))
const LiveMaintenancePanel = lazy(() => import('./LiveMaintenancePanel').then((module) => ({ default: module.LiveMaintenancePanel })))
const LiveMaintenancePlanPanel = lazy(() => import('./LiveMaintenancePlanPanel').then((module) => ({ default: module.LiveMaintenancePlanPanel })))
const LiveMaintenanceResultPanel = lazy(() => import('./LiveMaintenanceResultPanel').then((module) => ({ default: module.LiveMaintenanceResultPanel })))
const LiveQrScannerPanel = lazy(() => import('./LiveQrScannerPanel').then((module) => ({ default: module.LiveQrScannerPanel })))
const QrEquipmentResult = lazy(() => import('./QrEquipmentResult').then((module) => ({ default: module.QrEquipmentResult })))
const LiveSparePartsAutoPanel = lazy(() => import('./LiveSparePartsAutoPanel').then((module) => ({ default: module.LiveSparePartsAutoPanel })))
const LiveToolingPanel = lazy(() => import('./LiveToolingPanel').then((module) => ({ default: module.LiveToolingPanel })))

type View = 'dashboard' | 'qr' | 'equipment' | 'inspection' | 'maintenance' | 'spare' | 'tooling' | 'calibration' | 'print' | 'settings'
const NAV: Array<{ id: View; label: string; adminOnly?: boolean }> = [{id:'dashboard',label:'Tổng quan'},{id:'qr',label:'Quét QR'},{id:'equipment',label:'Thiết bị'},{id:'inspection',label:'Kiểm tra ngày'},{id:'maintenance',label:'Bảo trì'},{id:'spare',label:'Phụ tùng'},{id:'tooling',label:'Jig, gá & dụng cụ'},{id:'calibration',label:'Hiệu chuẩn'},{id:'print',label:'Hồ sơ A4'},{id:'settings',label:'Nhật ký & cấu hình',adminOnly:true}]
const MOBILE_PRIMARY: Array<{ id: View; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Trang chủ', icon: '⌂' },
  { id: 'maintenance', label: 'Công việc', icon: '⚒' },
  { id: 'qr', label: 'Quét QR', icon: '▣' },
  { id: 'equipment', label: 'Thiết bị', icon: '▤' },
]
const ROLE_LABEL: Record<AppRole,string> = { MAINTENANCE:'Bảo trì', SUPERVISOR:'Giám sát', QUALITY:'Chất lượng', MANAGER:'Quản lý', ADMIN:'Quản trị hệ thống', UNKNOWN:'Chưa xác định' }
function initialView():View{const requested=new URLSearchParams(window.location.search).get('phase3');if(requested==='qr'||requested==='equipment'||requested==='dashboard'||requested==='inspection'||requested==='maintenance'||requested==='spare'||requested==='tooling'||requested==='calibration'||requested==='print')return requested;if(requested==='audit')return'settings';return'dashboard'}
function initialEquipmentTarget(){return new URLSearchParams(window.location.search).get('equipment')?.trim().toUpperCase()||''}
function normalizeRole(value:string):AppRole{return['MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN'].includes(value)?value as AppRole:'UNKNOWN'}
function LiveView({view,equipmentTarget,onOpenEquipment,onCloseQrResult,onEditQrResult,onNavigate}:{view:View;equipmentTarget:string;onOpenEquipment:(equipmentId:string)=>void;onCloseQrResult:()=>void;onEditQrResult:()=>void;onNavigate:(view:View)=>void}){if(view==='dashboard')return <LiveDashboardPanel onNavigate={onNavigate}/>;if(view==='qr')return <LiveQrScannerPanel onOpenEquipment={onOpenEquipment}/>;if(view==='equipment'&&equipmentTarget)return <QrEquipmentResult equipmentId={equipmentTarget} onClose={onCloseQrResult} onEdit={onEditQrResult}/>;if(view==='equipment')return <div className="maintenance-workspace-stack"><LiveEquipmentRegistrationPanel/><LiveEquipmentPanel/></div>;if(view==='inspection')return <LiveInspectionPanel/>;if(view==='maintenance')return <div className="maintenance-workspace-stack"><LiveMaintenancePlanPanel/><LiveMaintenanceResultPanel/><LiveHandoverPanel/><LiveDowntimePanel/><LiveMaintenancePanel/></div>;if(view==='spare')return <LiveSparePartsAutoPanel/>;if(view==='tooling')return <LiveToolingPanel/>;if(view==='calibration')return <div className="maintenance-workspace-stack"><LiveCalibrationPanel/><LiveCalibrationEvaluationPanel/><LiveCalibrationQuotePanel/></div>;if(view==='print')return <A4PrintCenter/>;return <LiveAuditPanel/>}
export default function App() { return <><PwaStatus/><AuthGate>{(session, signOut) => <AppWorkspace session={session} signOut={signOut}/>}</AuthGate></> }
function AppWorkspace({session,signOut}:{session:LiveSession;signOut:()=>Promise<void>}){
  const initial=initialView()
  const[view,setView]=useState<View>(initial)
  const[visitedViews,setVisitedViews]=useState<Set<View>>(()=>new Set([initial]))
  const[equipmentTarget,setEquipmentTarget]=useState(initialEquipmentTarget)
  const[returnEquipmentId,setReturnEquipmentId]=useState('')
  const[mobileMoreOpen,setMobileMoreOpen]=useState(false)
  const role=normalizeRole(session.role)
  const sessionEmail=session.email
  const roleLoaded=true

  function markVisited(nextView:View){setVisitedViews((current)=>current.has(nextView)?current:new Set([...current,nextView]))}
  useEffect(()=>{if(roleLoaded&&view==='settings'&&!canViewAudit(role)){markVisited('dashboard');setView('dashboard')}},[role,roleLoaded,view])

  const visibleNav=useMemo(()=>NAV.filter((item)=>!item.adminOnly||canViewAudit(role)),[role])
  const mobileMoreItems=useMemo(()=>visibleNav.filter((item)=>!MOBILE_PRIMARY.some((primary)=>primary.id===item.id)),[visibleNav])
  const mountedViews=useMemo(()=>visibleNav.filter((item)=>visitedViews.has(item.id)),[visibleNav,visitedViews])

  function syncUrl(nextView:View,equipmentId=''){
    const url=new URL(window.location.href)
    url.searchParams.set('phase3',nextView==='settings'?'audit':nextView)
    if(equipmentId)url.searchParams.set('equipment',equipmentId)
    else url.searchParams.delete('equipment')
    window.history.replaceState({},'',url)
  }
  function openEquipmentFromQr(equipmentId:string){setMobileMoreOpen(false);markVisited('equipment');setEquipmentTarget(equipmentId);setView('equipment');syncUrl('equipment',equipmentId)}
  function openView(nextView:View){setMobileMoreOpen(false);setReturnEquipmentId('');markVisited(nextView);setView(nextView);setEquipmentTarget('');syncUrl(nextView);window.scrollTo({top:0,behavior:'auto'})}
  function openContextView(nextView:View,equipmentId:string){setMobileMoreOpen(false);setReturnEquipmentId(equipmentId.trim().toUpperCase());markVisited(nextView);setView(nextView);setEquipmentTarget('');syncUrl(nextView);window.scrollTo({top:0,behavior:'auto'})}
  function backToEquipmentContext(){if(!returnEquipmentId)return;const equipmentId=returnEquipmentId;setReturnEquipmentId('');markVisited('equipment');setEquipmentTarget(equipmentId);setView('equipment');syncUrl('equipment',equipmentId);window.scrollTo({top:0,behavior:'auto'})}
  function closeQrResult(){markVisited('qr');setEquipmentTarget('');setView('qr');syncUrl('qr')}
  function editQrResult(){markVisited('equipment');setEquipmentTarget('');setView('equipment');syncUrl('equipment')}

  useEffect(()=>{
    const handleNavigate=(event:Event)=>{
      const detail=(event as CustomEvent<{view?:View;equipmentId?:string}>).detail
      const requested=detail?.view
      if(requested&&NAV.some((item)=>item.id===requested))openContextView(requested,detail?.equipmentId||'')
    }
    window.addEventListener('cev:navigate',handleNavigate)
    return()=>window.removeEventListener('cev:navigate',handleNavigate)
  },[])

  const mobileNav=<><nav className="bottom-nav mobile-primary-nav" aria-label="Điều hướng trên điện thoại">{MOBILE_PRIMARY.map((item)=><button key={item.id} type="button" className={`${item.id===view?'active ':''}${item.id==='qr'?'scan-action':''}`.trim()} aria-current={item.id===view?'page':undefined} onClick={()=>openView(item.id)}><span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}<button type="button" className={mobileMoreOpen?'active':''} aria-expanded={mobileMoreOpen} onClick={()=>setMobileMoreOpen((current)=>!current)}><span className="mobile-nav-icon" aria-hidden="true">•••</span><span>Thêm</span></button></nav>{mobileMoreOpen?<div className="mobile-more-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setMobileMoreOpen(false)}}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Các chức năng khác"><header><div><p className="eyebrow">Quản lý thiết bị CEV</p><h2>Chức năng khác</h2></div><button type="button" aria-label="Đóng" onClick={()=>setMobileMoreOpen(false)}>×</button></header><div className="mobile-more-grid">{mobileMoreItems.map((item)=><button key={item.id} type="button" className={item.id===view?'active':''} onClick={()=>openView(item.id)}><strong>{item.label}</strong><small>Mở chức năng</small></button>)}</div><div className="mobile-more-account"><strong>{ROLE_LABEL[role]}</strong><span>{sessionEmail||'Xác thực Supabase'}</span><button type="button" onClick={()=>{setMobileMoreOpen(false);void signOut()}}>Đăng xuất</button></div></section></div>:null}</>

  return <AppRoleProvider role={role}><div className="app-shell" data-role={role}><a className="skip-link" href="#main-content">Bỏ qua điều hướng</a><aside className="sidebar" aria-label="Điều hướng trên máy tính"><div className="brand"><span className="brand-mark" aria-hidden="true">CEV</span><div><strong>Thiết bị</strong><small>IATF 16949</small></div></div><nav>{visibleNav.map((item)=><button key={item.id} type="button" className={item.id===view?'active':''} aria-current={item.id===view?'page':undefined} onClick={()=>openView(item.id)}>{item.label}</button>)}</nav><div className="sidebar-user"><strong>{roleLoaded?ROLE_LABEL[role]:'...'}</strong><span>{sessionEmail||'Xác thực Supabase'}</span><button type="button" onClick={()=>void signOut()}>Đăng xuất</button></div><div className="sidebar-note">Hệ thống quản lý thiết bị CEV<br/>Dữ liệu trực tiếp từ Supabase</div></aside><div className="app-body"><main id="main-content" className={`main-content${view==='equipment'?' equipment-main':''}`} tabIndex={-1}>{returnEquipmentId&&view!=='equipment'?<div className="equipment-context-nav"><button type="button" onClick={backToEquipmentContext}>← Trở về {returnEquipmentId}</button><span>Quay lại hồ sơ thiết bị trước đó</span></div>:null}{mountedViews.map((item)=><section key={item.id} hidden={item.id!==view} aria-hidden={item.id!==view} className="workspace-keepalive-pane"><AppErrorBoundary><Suspense fallback={<div className="workspace-loading" role="status">Đang mở chức năng…</div>}><LiveView view={item.id} equipmentTarget={item.id==='equipment'&&view==='equipment'?equipmentTarget:''} onOpenEquipment={openEquipmentFromQr} onCloseQrResult={closeQrResult} onEditQrResult={editQrResult} onNavigate={openView}/></Suspense></AppErrorBoundary></section>)}</main></div></div>{createPortal(mobileNav,document.body)}</AppRoleProvider>
}
