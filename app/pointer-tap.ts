/** Distinguish a tap from an orbit, pinch, pan, or canceled touch sequence. */
export class PointerTap {
 private active=new Map<number,{x:number;y:number;threshold:number;started:number}>();
 private blocked=false;
 down(id:number,x:number,y:number,threshold:number,started=performance.now()){
  if(this.active.size===0)this.blocked=false;
  this.active.set(id,{x,y,threshold,started});
  if(this.active.size>1)this.blocked=true;
 }
 move(id:number,x:number,y:number){
  const start=this.active.get(id);
  if(start&&Math.hypot(x-start.x,y-start.y)>start.threshold)this.blocked=true;
 }
 blockFromControls(){if(this.active.size)this.blocked=true;}
 hasActivePointer(){return this.active.size>0;}
 up(id:number,x:number,y:number,ended=performance.now()){
  this.move(id,x,y);
  const start=this.active.get(id),tap=!!start&&this.active.size===1&&!this.blocked&&ended-start.started<=550;
  this.active.delete(id);
  return tap;
 }
 cancel(id:number){this.active.delete(id);this.blocked=true}
}
