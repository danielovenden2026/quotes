import {formatMarginPct,type Margin} from '@/lib/margin-math';
export default function DemoMargin({margin,summary=false}:{margin:Margin;summary?:boolean}){
 const value=formatMarginPct(margin);
 if(!summary)return <strong className={'demo-line-gp '+(margin.low?'low':'')} title={'Sample cost · '+margin.reason}>{value}</strong>;
 return <div className={'demo-gp-summary '+(margin.pct===null?'unknown':margin.low?'low':'')}><strong>Overall product GP%</strong><span className="demo-gp-value">{value}</span><p>{margin.reason.replaceAll('Average Cost','sample cost')}</p><small>Sample costs for testing. Includes selected options. Excludes freight, handling, pickup and GST.</small></div>;
}
