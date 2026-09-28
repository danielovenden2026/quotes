import {emptyStock,type StockLevels} from './stock';
// Fictional warehouse stock, isolated from the private Google Sheet.
const samples:Record<string,StockLevels>={
 V4000:{totalStock:28,committedStock:6,melbourne:8,brisbane:5,sydney:15},
 V4070:{totalStock:12,committedStock:3,melbourne:3,brisbane:0,sydney:9},
 V4002:{totalStock:65,committedStock:12,melbourne:20,brisbane:15,sydney:30},
 V4000A:{totalStock:0,committedStock:0,melbourne:0,brisbane:0,sydney:0},
 'DEMO-LANYARD':{totalStock:40,committedStock:8,melbourne:10,brisbane:10,sydney:20},
 'DEMO-PINS':{totalStock:18,committedStock:4,melbourne:0,brisbane:6,sydney:12},
};
export const demoStock=(sku:string):StockLevels=>samples[sku.trim().toUpperCase()]||emptyStock();
