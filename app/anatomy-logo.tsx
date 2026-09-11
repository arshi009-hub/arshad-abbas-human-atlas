import {ScanHeart} from 'lucide-react';

interface AnatomyLogoProps {
 className?:string;
 size?:'header'|'opening';
}

export default function AnatomyLogo({className='',size='header'}:AnatomyLogoProps){
 return <span className={`anatomy-logo anatomy-logo-${size} ${className}`.trim()} style={size==='opening'?{width:90,height:90}:undefined} aria-hidden="true">
  <ScanHeart className="anatomy-logo-scan" strokeWidth={1.55}/>
  <svg className="anatomy-logo-pulse" viewBox="0 0 24 24" fill="none" focusable="false">
   <path d="M5.5 12h3l1.35-2.65 2.2 5.3L13.8 12h4.7"/>
  </svg>
  <span className="anatomy-logo-node"/>
 </span>;
}
