import './EquipmentMobile.css'
import './EquipmentMobileSheet.css'
import './EquipmentMobileForms.css'
import { LiveEquipmentRegistrationPanel } from '../../LiveEquipmentRegistrationPanel'
import { EquipmentMobilePanel } from './EquipmentMobilePanel'

/** Mobile Equipment composition. Desktop UI must never be imported here. */
export function EquipmentMobileWorkspace() {
  return <div className="maintenance-workspace-stack equipment-mobile-workspace"><LiveEquipmentRegistrationPanel/><EquipmentMobilePanel/></div>
}
