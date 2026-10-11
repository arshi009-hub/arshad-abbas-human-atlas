import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
export default defineConfig({root:path('./web'),publicDir:path('./public'),plugins:[react()],resolve:{alias:{'@':path('./')}},css:{postcss:{plugins:[tailwindcss()]}},server:{watch:{usePolling:true}},build:{outDir:path('./dist'),emptyOutDir:true,chunkSizeWarningLimit:700,rolldownOptions:{output:{advancedChunks:{groups:[{name:'three',test:/node_modules[\\/]three[\\/]/},{name:'vendor',test:/node_modules[\\/](react|react-dom|scheduler|@base-ui|@floating-ui)[\\/]/}]}}}}});
