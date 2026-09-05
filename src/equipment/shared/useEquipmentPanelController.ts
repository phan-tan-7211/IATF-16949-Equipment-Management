import { useEffect, useMemo, useState } from 'react'
import { canEditEquipment, useAppRole } from '../../auth/AppRoleContext'
import { buildEquipmentMasterSuggestions } from '../../data/equipmentMasterFields'
import { loadLiveEquipment, type LiveEquipment } from '../../data/liveEquipment'
import { getEquipmentCacheSnapshot } from '../../data/supabaseEquipment'
import { photoHoverPosition } from './equipmentColumns'
import { useEquipmentBulkEdit } from './useEquipmentBulkEdit'
import { useEquipmentEditing } from './useEquipmentEditing'
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
  const [loading,setLoading]=useState(()=>getEquipmentCacheSnapshot().length===0)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')

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

  const {
    bulkMode,setBulkMode,bulkSaving,inlineChanges,setInlineChanges,dirtyCount,
    setInlineCell,exitBulkMode,saveInlineChanges,
  }=useEquipmentBulkEdit({rows,setRows,setError,setMessage})

  const {
    editing,setEditing,profileId,setProfileId,saving,deleting,editCriticality,profileEquipment,
    openEdit,handleSave,handleDelete,
  }=useEquipmentEditing({rows,setRows,setMessage,reloadEquipment,removeEquipmentPhotoState})

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

  const productionCount=rows.filter((row)=>row.equipmentType==='PRODUCTION').length
  const measurementCount=rows.filter((row)=>row.equipmentType==='MEASUREMENT').length

  function openPhotoHover(url:string,name:string,clientX:number,clientY:number){
    if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return
    setPhotoHover({url,name,...photoHoverPosition(clientX,clientY)})
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
