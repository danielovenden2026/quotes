export default function ProductNote({note,plain=false}:{note?:string;plain?:boolean}){
 if(!note?.trim())return null;
 return plain?<p className="product-note-plain">{note}</p>:<section className="product-details-note"><strong>Product notes</strong><p>{note}</p></section>;
}
