'use client';
import {useEffect,useState,type InputHTMLAttributes} from 'react';

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'|'value'|'defaultValue'|'onChange'> & {
 value:number;
 decimalPlaces?:number;
 onValueChange:(value:number)=>void;
};

export default function WorkspaceNumberInput({value,onValueChange,decimalPlaces,onBlur,className='',...props}:Props){
 const [text,setText]=useState(decimalPlaces===undefined?String(value):value.toFixed(decimalPlaces));
 // Keep a cleared field blank while retaining numeric values for quote calculations.
 useEffect(()=>{setText(current=>Number(current)===value?current:decimalPlaces===undefined?String(value):value.toFixed(decimalPlaces));},[value,decimalPlaces]);
 return <input {...props} className={'workspace-number-input '+className} type="number" value={text} onBlur={event=>{if(decimalPlaces!==undefined)setText(current=>current===''?current:Number(current).toFixed(decimalPlaces));onBlur?.(event);}} onChange={event=>{
  const next=event.target.value;
  setText(next);
  onValueChange(next===''?0:Number(next));
 }}/>;
}
