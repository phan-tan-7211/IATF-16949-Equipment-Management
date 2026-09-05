import './EquipmentDesktop.css'
import './EquipmentDesktopSheet.css'
import { LiveEquipmentRegistrationPanel } from '../../LiveEquipmentRegistrationPanel'
import { EquipmentDesktopPanel } from './EquipmentDesktopPanel'

/** Desktop Equipment composition. Mobile UI must never be imported here. */
export function EquipmentDesktopWorkspace() {
  return <div className="maintenance-workspace-stack equipment-desktop-workspace"><LiveEquipmentRegistrationPanel/><EquipmentDesktopPanel/></div>
}
