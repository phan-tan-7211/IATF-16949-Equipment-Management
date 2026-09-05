import '../../equipment/mobile/EquipmentMobile.css'
import { LiveEquipmentRegistrationPanel } from '../../LiveEquipmentRegistrationPanel'
import { LiveEquipmentPanel } from '../../LiveEquipmentPanel'

/** Mobile Equipment composition. Desktop composition must not be added here. */
export function EquipmentMobileWorkspace() {
  return <div className="maintenance-workspace-stack equipment-mobile-workspace"><LiveEquipmentRegistrationPanel/><LiveEquipmentPanel/></div>
}
