export const australianStates=['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'] as const;
export type AustralianState=typeof australianStates[number];
export const stateNames:Record<AustralianState,string>={ACT:'Australian Capital Territory',NSW:'New South Wales',NT:'Northern Territory',QLD:'Queensland',SA:'South Australia',TAS:'Tasmania',VIC:'Victoria',WA:'Western Australia'};
export function stateDisplayName(state?:string){
 const value=state?.trim()||'';
 return stateNames[value.toUpperCase() as AustralianState]||value;
}
// Existing quotes retain their complete address until sales splits it into fields.
export function deliveryAddress(q:{address:string;suburb?:string;state?:string;postcode?:string}){
 const locality=[q.suburb,stateDisplayName(q.state),q.postcode].map(v=>v?.trim()||'').filter(Boolean).join(' ');
 return [q.address.trim(),locality].filter(Boolean).join(', ');
}
