'use client';
import {Children,useEffect,useState,type ReactNode} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Carousel,CarouselContent,CarouselItem,type CarouselApi} from '@/components/ui/carousel';

export default function OptionalCarousel({children}:{children:ReactNode}){
 const cards=Children.toArray(children),fixedDesktop=cards.length<=4;
 const [api,setApi]=useState<CarouselApi>(),[navigation,setNavigation]=useState({previous:false,next:false});
 useEffect(()=>{
  if(!api)return;
  const update=()=>setNavigation({previous:api.canScrollPrev(),next:api.canScrollNext()});
  update();api.on('reInit',update);api.on('select',update);
  return ()=>{api.off('reInit',update);api.off('select',update);};
 },[api]);
 return <Carousel className={"extras-carousel"+(fixedDesktop?" extras-carousel-fixed-desktop":"")} opts={{breakpoints:{"(min-width: 1101px)":{active:!fixedDesktop}},align:'start',containScroll:'trimSnaps',slidesToScroll:'auto',loop:false}} setApi={setApi} aria-label="Additional product options">
  <CarouselContent className="extras-carousel-track">{cards.map(child=><CarouselItem className="extras-carousel-item" key={(child as {key?:string}).key}>{child}</CarouselItem>)}</CarouselContent>
  {(navigation.previous||navigation.next)&&<div className="extras-carousel-footer">
   <Button type="button" variant="outline" size="icon-sm" className="extras-footer-arrow" disabled={!navigation.previous} onClick={()=>api?.scrollPrev()} aria-label="Previous optional items"><ArrowLeft size={16}/></Button>
   <Button type="button" variant="outline" size="icon-sm" className="extras-footer-arrow" disabled={!navigation.next} onClick={()=>api?.scrollNext()} aria-label="Next optional items"><ArrowRight size={16}/></Button>
  </div>}
 </Carousel>;
}
