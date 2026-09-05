import '../../Equipment.css'
import '../../EquipmentSheetView.css'
import { EquipmentProfile } from '../../EquipmentProfile'
import { EquipmentMasterEditFields } from '../../EquipmentMasterEditFields'
import { EquipmentInlineCell } from '../../components/EquipmentInlineCell'
import type { LiveEquipment } from '../../data/liveEquipment'
import type { EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import {
  COLUMNS,
  booleanSelectValue,
  columnValue,
  defaultVisibleColumns,
  documentLinks,
  inlineValue,
  parseBooleanSelect,
  patchKeyForColumn,
  statusLabel,
  type ColumnDef,
  type ColumnKey,
  useEquipmentPanelController,
} from '../shared/useEquipmentPanelController'

export function EquipmentMobilePanel() {
  const c = useEquipmentPanelController()

  function renderHeader(column:ColumnDef){
    const selected=c.columnFilters[column.key]||[]
    const options=c.filterOptions(column.key).filter((value)=>value.toLocaleLowerCase().includes(c.filterSearch.toLocaleLowerCase()))
    const active=c.sortKey===column.key
    return <th key={column.key} className="equipment-sheet-head" aria-sort={active?(c.sortDirection==='asc'?'ascending':'descending'):'none'}><div className="equipment-sheet-head-main"><button className={`equipment-sort${active?' active':''}`} type="button" onClick={()=>c.toggleSort(column.key)}>{column.label}<span aria-hidden="true">{active?(c.sortDirection==='asc'?'▲':'▼'):'↕'}</span></button><button className={`equipment-filter-button${selected.length?' active':''}`} type="button" aria-label={`Lọc ${column.label}`} onClick={()=>{c.setColumnPickerOpen(false);c.setFilterColumn((current)=>current===column.key?null:column.key);c.setFilterSearch('')}}>▼{selected.length?<span className="equipment-filter-count">{selected.length}</span>:null}</button></div>{c.filterColumn===column.key?<div className="equipment-filter-popover"><input type="search" value={c.filterSearch} onChange={(event)=>c.setFilterSearch(event.target.value)} placeholder={`Tìm trong ${column.label.toLocaleLowerCase()}…`}/><div className="equipment-filter-actions"><button type="button" onClick={()=>c.clearFilter(column.key)}>Bỏ lọc</button><button type="button" onClick={()=>c.setColumnFilters((current)=>({...current,[column.key]:c.filterOptions(column.key)}))}>Chọn tất cả</button></div>{options.map((value)=><label className="equipment-filter-option" key={value}><input type="checkbox" checked={selected.includes(value)} onChange={()=>c.toggleFilterValue(column.key,value)}/><span>{value}</span></label>)}</div>:null}</th>
  }

  function renderCell(equipment:LiveEquipment,column:ColumnDef){
    const key=column.key
    const patchKey=patchKeyForColumn(key)
    if(c.bulkMode&&patchKey)return <EquipmentInlineCell equipment={equipment} columnKey={key} label={column.label} value={inlineValue(equipment,key,c.inlineChanges)} onChange={(value)=>c.setInlineCell(equipment,key,value)}/>
    if(c.bulkMode&&!patchKey)return <span className="equipment-inline-readonly">{columnValue(equipment,key)||'—'}</span>
    if(key==='equipmentId')return <button className="equipment-link" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)}>{equipment.equipmentId}</button>
    if(key==='equipmentName')return <button className="equipment-link equipment-name-link" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)}>{equipment.equipmentName}</button>
    if(key==='status')return <span className={`equipment-status status-${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status]||equipment.status}</span>
    if(key==='relatedDocuments'){const links=documentLinks(equipment.relatedDocuments);return links.length?<div className="equipment-doc-links">{links.slice(0,3).map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer">{index===0?'Mở tài liệu':`Tài liệu ${index+1}`}</a>)}</div>:<span className="equipment-cell-muted">{equipment.relatedDocuments||'—'}</span>}
    return columnValue(equipment,key)||'—'
  }

  return <div className="equipment-page equipment-mobile-panel">
    <header className="equipment-mobile-title"><p className="eyebrow">Danh mục thiết bị</p><h2>Danh sách thiết bị</h2><p>{c.sortedRows.length} / {c.rows.length} thiết bị · toàn bộ trường master đều có thể bật cột và lọc</p></header>
    <section className="equipment-summary" aria-label="Tổng quan thiết bị"><article><span>Tổng thiết bị</span><strong>{c.rows.length}</strong></article><article><span>Thiết bị sản xuất</span><strong>{c.productionCount}</strong></article><article><span>Thiết bị đo kiểm</span><strong>{c.measurementCount}</strong></article></section>
    <section className="equipment-mobile-actions" aria-label="Thao tác danh sách">{c.canBulkEdit?<button className={`equipment-bulk-mode-toggle${c.bulkMode?' active':''}`} type="button" onClick={()=>c.bulkMode?c.exitBulkMode():c.setBulkMode(true)}>{c.bulkMode?'Thoát sửa':'Sửa hàng loạt'}</button>:<span/>}<button className="equipment-refresh" type="button" onClick={()=>void c.reloadEquipment(true)} disabled={c.loading||c.bulkSaving}>Làm mới</button><button className="equipment-mobile-register-placeholder" type="button" data-equipment-register-anchor="mobile">+ Đăng ký</button></section>
    <section className="equipment-mobile-tools" role="search"><label className="equipment-search"><span className="sr-only">Tìm thiết bị</span><input value={c.query} onChange={(event)=>c.setQuery(event.target.value)} placeholder="Tìm trên toàn bộ dữ liệu thiết bị…"/></label><div className="equipment-sheet-tools"><div className="equipment-column-picker" ref={c.columnPickerRef}><button className={c.columnPickerOpen?'active':''} type="button" aria-expanded={c.columnPickerOpen} onClick={()=>{c.setFilterColumn(null);c.setFilterSearch('');c.setColumnPickerOpen((value)=>!value)}}>Cột hiển thị · {c.visibleColumns.length}/{COLUMNS.length}</button>{c.columnPickerOpen?<div className="equipment-column-menu"><header><strong>Ẩn / hiện cột</strong><div><button type="button" onClick={()=>c.setVisibleColumns(COLUMNS.map((column)=>column.key))}>Hiện tất cả</button><button type="button" onClick={()=>c.setVisibleColumns(defaultVisibleColumns())}>Mặc định</button></div></header>{(['Nhận diện','Quản lý','Kỹ thuật','Vòng đời','Tài liệu','Hệ thống'] as const).map((group)=><div key={group}><small>{group}</small>{COLUMNS.filter((column)=>column.group===group).map((column)=><label key={column.key}><input type="checkbox" checked={c.visibleColumns.includes(column.key)} onChange={()=>c.toggleColumn(column.key)}/><span>{column.label}</span></label>)}</div>)}</div>:null}</div><button type="button" className={c.activeFilterCount?'active':''} onClick={()=>c.setColumnFilters({})}>Bỏ toàn bộ lọc{c.activeFilterCount?` · ${c.activeFilterCount}`:''}</button></div></section>
    {c.bulkMode&&c.canBulkEdit?<div className="equipment-spreadsheet-bar"><div className="equipment-spreadsheet-actions"><button type="button" onClick={()=>c.setInlineChanges({})} disabled={!c.dirtyCount||c.bulkSaving}>Hoàn tác</button><button className="save" type="button" onClick={()=>void c.saveInlineChanges()} disabled={!c.dirtyCount||c.bulkSaving}>{c.bulkSaving?'Đang lưu…':`Lưu ${c.dirtyCount}`}</button><button type="button" onClick={c.exitBulkMode} disabled={c.bulkSaving}>Thoát</button></div></div>:null}
    {c.message?<div className="equipment-feedback" role="status">{c.message}</div>:null}{c.error?<div className="equipment-state error" role="alert">{c.error}</div>:null}{c.loading&&c.rows.length===0?<div className="equipment-state">Đang tải danh mục thiết bị…</div>:null}
    {c.rows.length>0?<div className="equipment-mobile-table-scroll"><table className={`equipment-data-table${c.bulkMode?' spreadsheet-mode':''}`}><caption className="sr-only">Danh sách thiết bị</caption><thead><tr><th>Ảnh</th>{COLUMNS.filter((column)=>c.visibleColumns.includes(column.key)).map(renderHeader)}<th aria-label="Thao tác"/></tr></thead><tbody>{c.sortedRows.map((equipment)=>{const photo=c.photos[equipment.equipmentId]||{state:'loading',url:''};const pasteReady=photo.state==='no';const dirty=Boolean(c.inlineChanges[equipment.equipmentId]);return <tr key={equipment.equipmentId} className={dirty?'is-dirty':''}><td className={`equipment-image-col${pasteReady?' paste-ready':''}`} tabIndex={pasteReady?0:undefined} title={pasteReady?'Chọn ô ảnh rồi nhấn Ctrl+V để dán ảnh':'Mở hồ sơ thiết bị'} onPaste={pasteReady?(event)=>void c.handleEmptyPhotoCellPaste(equipment.equipmentId,event):undefined}>{photo.state==='yes'&&photo.url?<button className="equipment-image-button" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)}><img src={photo.url} alt={equipment.equipmentName}/></button>:photo.state==='loading'?<span className="equipment-photo-state">…</span>:<button className="equipment-photo-empty" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)}>Chưa có ảnh</button>}</td>{COLUMNS.filter((column)=>c.visibleColumns.includes(column.key)).map((column)=><td key={column.key}>{renderCell(equipment,column)}</td>)}<td>{c.bulkMode?<span className={dirty?'equipment-inline-dirty-dot':'equipment-cell-muted'}>{dirty?'Đã sửa':'—'}</span>:<button className="equipment-edit-row" type="button" onClick={()=>c.openEdit(equipment)}>Sửa</button>}</td></tr>})}</tbody></table></div>:null}
    <MobileOverlays controller={c}/>
  </div>
}

function MobileOverlays({controller:c}:{controller:ReturnType<typeof useEquipmentPanelController>}) {
  const editing=c.editing
  return <>
    {c.profileEquipment?<EquipmentProfile equipment={c.profileEquipment} photoUrl={c.photos[c.profileEquipment.equipmentId]?.url||''} onClose={()=>c.setProfileId('')} onEdit={()=>c.openEdit(c.profileEquipment!)}/>:null}
    {editing?<div className="equipment-drawer-backdrop equipment-mobile-drawer-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!c.saving&&!c.deleting)c.setEditing(null)}}><section className="equipment-drawer equipment-mobile-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-drawer-title-mobile"><header><div><p className="eyebrow">Danh mục thiết bị</p><h2 id="equipment-drawer-title-mobile">Chỉnh sửa thiết bị</h2></div><button type="button" onClick={()=>c.setEditing(null)} disabled={c.saving||c.deleting} aria-label="Đóng">×</button></header><div className="equipment-drawer-scroll"><div className="equipment-edit-photo">{c.photos[editing.equipmentId]?.url?<img src={c.photos[editing.equipmentId].url} alt={`Ảnh ${editing.equipmentName}`}/>:<div className="equipment-edit-photo-empty">Chưa có ảnh</div>}<div className="equipment-edit-photo-actions"><button type="button" onClick={()=>void c.handleClipboardUpload(editing.equipmentId)} disabled={!!c.uploadingId||!!c.deletingPhotoId}>{c.uploadingId===editing.equipmentId?'Đang tải…':'Dán ảnh từ bộ nhớ tạm'}</button><label className="equipment-edit-photo-picker">Chọn ảnh<input type="file" accept="image/*" capture="environment" disabled={!!c.uploadingId||!!c.deletingPhotoId} onChange={(event)=>void c.handlePhotoUpload(editing.equipmentId,event.currentTarget.files?.[0])}/></label>{c.photos[editing.equipmentId]?.url?<button className="equipment-edit-photo-delete" type="button" onClick={()=>void c.handlePhotoDelete(editing.equipmentId)} disabled={!!c.uploadingId||!!c.deletingPhotoId}>{c.deletingPhotoId===editing.equipmentId?'Đang xóa ảnh…':'Xóa ảnh'}</button>:null}<small>1 thiết bị = 1 ảnh · tự nén trước khi lưu</small></div></div><EquipmentMasterEditFields value={editing} suggestions={c.masterSuggestions} onChange={c.setEditing}/><CriticalityEditor editing={editing} setEditing={c.setEditing} result={c.editCriticality}/></div><footer><button className="equipment-delete" type="button" onClick={()=>void c.handleDelete()} disabled={c.saving||c.deleting}>{c.deleting?'Đang xóa…':'Xóa thiết bị'}</button><div className="equipment-drawer-footer-actions"><button type="button" onClick={()=>c.setEditing(null)} disabled={c.saving||c.deleting}>Hủy</button><button type="button" onClick={()=>void c.handleSave()} disabled={c.saving||c.deleting||!c.editCriticality}>{c.saving?'Đang lưu…':'Lưu thay đổi'}</button></div></footer></section></div>:null}
  </>
}

function CriticalityEditor({editing,setEditing,result}:{editing:EquipmentMasterEditInput;setEditing:(value:EquipmentMasterEditInput)=>void;result:string}) {
  const questions:[ColumnKey,string][]=[['controlsProductQuality','1. Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng?'],['specialCharacteristicImpact','2. Liên quan đặc tính đặc biệt / an toàn sản phẩm?'],['stopsProduction','3. Mất chức năng có dừng công đoạn / dây chuyền?'],['hasBackup','4. Có thiết bị / phương án dự phòng dùng ngay?'],['capacityImpact','5. Mất chức năng có rủi ro sản lượng / giao hàng?']]
  return <fieldset className="equipment-edit-criticality"><legend>Mức độ quan trọng thiết bị · tự tính A/B/C/D</legend><p>Trả lời 5 sự thật của quá trình. Hệ thống tự tính lại cấp khi lưu.</p><div className="equipment-edit-criticality-grid">{questions.map(([key,label])=><label key={key}><span>{label}</span><select value={booleanSelectValue(editing[key as keyof EquipmentMasterEditInput] as boolean|undefined)} onChange={(event)=>setEditing({...editing,[key]:parseBooleanSelect(event.target.value)})}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>)}</div><div className={`equipment-edit-criticality-result${result?` level-${result.toLowerCase()}`:''}`}><span>Kết quả tự động</span><strong>{result?`Cấp ${result}`:'Trả lời đủ 5 câu'}</strong></div></fieldset>
}
