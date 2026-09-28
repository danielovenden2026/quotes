import {money,type Item} from '@/lib/quote';
import {hasDiscount,discountLabel,netUnitPrice} from '@/lib/line-pricing';
export default function LinePrice({item}:{item:Item}){
 if(!hasDiscount(item))return <strong>{money(item.price)}</strong>;
 return <span className="discounted-price"><del aria-label="Original quoted unit price">{money(item.price)}</del><span className="discount-label">{discountLabel(item)}</span><strong aria-label="Discounted unit price">{money(netUnitPrice(item))}</strong></span>;
}
