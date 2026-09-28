export const permissionLabels={createEdit:'Create and edit quotes',sendQuotes:'Send quotes to customers',createOnBehalf:'Create quotes on behalf of other users',viewCosts:'See unit cost & GP',viewTeam:'See all team quotes',applyDiscounts:'Apply item discounts',approveRestricted:'Administrator — approve high-value quotes and override margin block',superAdmin:'Super Administrator — edit all settings and manage users'} as const;
export type Permission=keyof typeof permissionLabels;
export type Permissions=Record<Permission,boolean>;
export const noPermissions:Permissions={createEdit:false,sendQuotes:false,createOnBehalf:false,viewCosts:false,viewTeam:false,applyDiscounts:false,approveRestricted:false,superAdmin:false};
export const allPermissions:Permissions={createEdit:true,sendQuotes:true,createOnBehalf:true,viewCosts:true,viewTeam:true,applyDiscounts:true,approveRestricted:true,superAdmin:true};
export const defaultPermissions:Permissions={...noPermissions,createEdit:true,sendQuotes:true,viewCosts:true,applyDiscounts:true};
export function effectivePermissions(value:Permissions):Permissions{return value.superAdmin?{...allPermissions}:value;}
