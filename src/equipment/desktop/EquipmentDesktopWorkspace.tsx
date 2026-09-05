import './EquipmentDesktop.css'
import './EquipmentDesktopSheet.css'
import { LiveEquipmentRegistrationPanel } from '../../LiveEquipmentRegistrationPanel'
import { LiveEquipmentPanel } from '../../LiveEquipmentPanel'

/** Desktop Equipment composition. Mobile composition must not be added here. */
export function EquipmentDesktopWorkspace() {
  return <div className="maintenance-workspace-stack equipment-desktop-workspace"><LiveEquipmentRegistrationPanel/><LiveEquipmentPanel/></div>
}
