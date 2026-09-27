import 'server-only';
import sanitizeHtml from 'sanitize-html';

export function sanitiseProductDescription(value:string):string {
  return sanitizeHtml(value, {
    allowedTags:['p','br','ul','ol','li','strong','b','em','i','u','s','sub','sup','div','span','h2','h3','h4','h5','h6','blockquote','hr','dl','dt','dd','table','thead','tbody','tfoot','tr','th','td'],
    allowedAttributes:{},
    disallowedTagsMode:'discard',
    nonTextTags:['script','style','textarea','option','noscript','iframe','object','svg','math','template'],
    parseStyleAttributes:false,
  }).trim();
}
