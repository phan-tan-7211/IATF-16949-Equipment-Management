import { useEffect, useMemo, useState } from 'react'
import { canEditEquipment, useAppRole } from '../../auth/AppRoleContext'
import { deriveEquipmentCriticality } from '../../data/autoRegistration'
import { bulkUpdateEquipmentRows } from '../../data/equipmentBulkEdit'
import { buildEquipmentMasterSuggestions } from '../../data/equipmentMasterFields'
import { loadLiveEquipment, type LiveEquipment } from '../../data/liveEquipment'
import { checkEquipmentDeletion, deleteUnusedEquipment } from '../../data/equipmentDeletion'
import { updateEquipmentDetails, type EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import { getEquipmentCacheSnapshot } from '../../data/supabaseEquipment'
import {
  patchKeyForColumn,
  photoHoverPosition,
  type ColumnKey,
  type InlineChanges,
} from './equipmentColumns'
import { mergeDraftIntoRow, mergeInlinePatch, toDraft } from './equipmentRowMappers'
import { useEquipmentPhotos } from './useEquipmentPhotos'
import { useEquipmentTableState } from './useEquipmentTableState'

export {
  COLUMNS,
  booleanSelectValue,
  columnValue,
  defaultVisibleColumns,
  documentLinks,
  inlineValue,
  parseBooleanSelect,
  patchKeyForColumn,
  photoHoverPosition,
  statusLabel,
} from './equipmentColumns'
export type { ColumnDef, ColumnFilters, ColumnKey, InlineChanges, PhotoHover, PhotoInfo, SortDirection } from './equipmentColumns'

export function useEquipmentPanelController() {
  const role = useAppRole()
  const canBulkEdit = canEditEquipment(role)
  const [rows,setRows]=useState<LiveEquipment[]>(()=>getEquipmentCacheSnapshot())
  const [editing,setEditing]=useState<EquipmentMasterEditInput|null>(null)
  const [profileId,setProfileId]=useState('')
  const [loading,setLoading]=useState(()=>getEquipmentCacheSnapshot().length===0)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState(false)
  const [bulkMode,setBulkMode]=useState(false)
  const [bulkSaving,setBulkSaving]=useState(false)
  const [inlineChanges,setInlineChanges]=useState<InlineChanges>({})

  const {
    query,setQuery,sortKey,sortDirection,
    visibleColumns,setVisibleColumns,columnPickerOpen,setColumnPickerOpen,
    filterColumn,setFilterColumn,filterSearch,setFilterSearch,columnFilters,setColumnFilters,
    photoHover,setPhotoHover,columnPickerRef,activeFilterCount,sortedRows,
    toggleSort,toggleColumn,filterOptions,toggleFilterValue,clearFilter,
  }=useEquipmentTableState(rows)

  const {
    photos,uploadingId,deletingPhotoId,refreshPhotoStates,removeEquipmentPhotoState,
    handlePhotoUpload,handlePhotoDelete,handleClipboardUpload,handleEmptyPhotoCellPaste,
  }=useEquipmentPhotos(setMessage)

  const masterSuggestions=useMemo(()=>buildEquipmentMasterSuggestions(rows.map((row)=>({...row,department:row.usingDepartment}))),[rows])

  async function reloadEquipment(force=false){
    const block=force||rows.length===0
    if(block)setLoading(true)
    try{
      const result=await loadLiveEquipment({force})
      setRows(result)
      setError('')
      void refreshPhotoStates(result)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Không thể tải danh mục thiết bị')
    }finally{
      if(block)setLoading(false)
    }
  }

  useEffect(()=>{
    const snapshot=getEquipmentCacheSnapshot()
    if(snapshot.length){
      setRows(snapshot)
      setLoading(false)
      void refreshPhotoStates(snapshot)
      void loadLiveEquipment({force:true}).then((result)=>{
        setRows(result)
        setError('')
        void refreshPhotoStates(result)
      }).catch(()=>undefined)
    }else{
      setLoading(true)
      void loadLiveEquipment({force:true}).then((result)=>{
        setRows(result)
        setError('')
        void refreshPhotoStates(result)
      }).catch((cause)=>setError(cause instanceof Error?cause.message:'Không thể tải danh mục thiết bị')).finally(()=>setLoading(false))
    }
  },[])

  useEffect(()=>{
    if(!editing)return
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setEditing(null)}
    window.addEventListener('keydown',onKeyDown)
    return()=>window.removeEventListener('keydown',onKeyDown)
  },[editing])

  const editCriticality=editing?deriveEquipmentCriticality(editing):''
  const productionCount=rows.filter((row)=>row.equipmentType==='PRODUCTION').length
  const measurementCount=rows.filter((row)=>row.equipmentType==='MEASUREMENT').length
  const profileEquipment=profileId?rows.find((row)=>row.equipmentId===profileId)||null:null
  const dirtyCount=Object.keys(inlineChanges).length

  function openPhotoHover(url:string,name:string,clientX:number,clientY:number){
    if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return
    setPhotoHover({url,name,...photoHoverPosition(clientX,clientY)})
  }

  function openEdit(row:LiveEquipment){setProfileId('');setEditing(toDraft(row))}

  function setInlineCell(equipment:LiveEquipment,key:ColumnKey,value:string|boolean){
    const patchKey=patchKeyForColumn(key)
    if(!patchKey)return
    setInlineChanges((current)=>({...current,[equipment.equipmentId]:{...(current[equipment.equipmentId]||{}),[patchKey]:value}}))
  }

  function exitBulkMode(){
    if(dirtyCount&&!window.confirm(`Bỏ ${dirtyCount} dòng chưa lưu?`))return
    setInlineChanges({})
    setBulkMode(false)
  }

  async function saveInlineChanges(){
    const changes=Object.entries(inlineChanges).map(([equipmentId,patch])=>({equipmentId,patch}))
    if(!changes.length)return
    const before=rows
    setBulkSaving(true)
    setError('')
    setMessage('')
    setRows((current)=>current.map((row)=>inlineChanges[row.equipmentId]?mergeInlinePatch(row,inlineChanges[row.equipmentId]):row))
    try{
      const result=await bulkUpdateEquipmentRows(changes)
      setInlineChanges({})
      setMessage(`Đã lưu ${result.updatedCount} dòng trực tiếp trên bảng.`)
    }catch(cause){
      setRows(before)
      setError(cause instanceof Error?cause.message:'Không thể lưu thay đổi trên bảng.')
    }finally{
      setBulkSaving(false)
    }
  }

  async function handleSave(){
    if(!editing)return
    if(!editing.equipmentName.trim()){setMessage('Tên thiết bị không được để trống.');return}
    if(!editing.managementResponsiblePrimary?.trim()){setMessage('Người phụ trách quản lý chính không được để trống.');return}
    if(!editCriticality){setMessage('Trả lời đủ 5 câu về mức độ quan trọng trước khi lưu.');return}
    setSaving(true)
    setMessage('')
    const draft=editing
    try{
      const result=await updateEquipmentDetails(draft)
      setRows((current)=>current.map((row)=>mergeDraftIntoRow(row,draft,result.criticality)))
      setMessage(`Đã lưu ${result.equipmentId} · Cấp ${result.criticality}`)
      setEditing(null)
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Không thể lưu thay đổi')
    }finally{
      setSaving(false)
    }
  }

  async function handleDelete(){
    if(!editing||deleting||saving)return
    const equipmentId=editing.equipmentId.trim().toUpperCase()
    setDeleting(true)
    setMessage('')
    try{
      const check=await checkEquipmentDeletion(equipmentId)
      if(!check.exists){
        setMessage(`${equipmentId} không còn tồn tại.`)
        setEditing(null)
        await reloadEquipment(true)
        return
      }
      if(!check.canDelete){
        setMessage(`Không thể xóa ${equipmentId} vì đã có dữ liệu liên quan. ${check.blockers.map((item)=>`${item.label}: ${item.count}`).join(' · ')}`)
        return
      }
      if(!window.confirm(`Xóa ${equipmentId} - ${editing.equipmentName}?\n\nThiết bị chưa có dữ liệu nghiệp vụ liên quan nên có thể xóa. Hệ thống cũng sẽ xóa toàn bộ ảnh của mã này. Hành động không thể hoàn tác.`))return
      const result=await deleteUnusedEquipment(equipmentId)
      setRows((current)=>current.filter((row)=>row.equipmentId!==equipmentId))
      removeEquipmentPhotoState(equipmentId)
      setProfileId('')
      setEditing(null)
      setMessage(`Đã xóa ${equipmentId}${Number(result.removedPhotos||0)>0?` và ${result.removedPhotos} ảnh`:''}.`)
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Không thể xóa thiết bị')
    }finally{
      setDeleting(false)
    }
  }

  return {
    rows, photos, editing, setEditing, profileId, setProfileId, loading, error, message, uploadingId, deletingPhotoId, saving, deleting,
    query, setQuery, sortKey, sortDirection, bulkMode, setBulkMode, bulkSaving, inlineChanges, setInlineChanges,
    visibleColumns, setVisibleColumns, columnPickerOpen, setColumnPickerOpen, filterColumn, setFilterColumn, filterSearch, setFilterSearch,
    columnFilters, setColumnFilters, photoHover, setPhotoHover, columnPickerRef, masterSuggestions, editCriticality, activeFilterCount,
    sortedRows, productionCount, measurementCount, profileEquipment, dirtyCount, canBulkEdit,
    reloadEquipment, openPhotoHover, openEdit, toggleSort, toggleColumn, filterOptions, toggleFilterValue, clearFilter, setInlineCell,
    exitBulkMode, saveInlineChanges, handleSave, handleDelete, handlePhotoUpload, handlePhotoDelete, handleClipboardUpload, handleEmptyPhotoCellPaste,
  }
}

export type EquipmentPanelController = ReturnType<typeof useEquipmentPanelController>
