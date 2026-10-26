export const I = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
export function trs(p=[0,0,0],q=[0,0,0,1]) {const [x,y,z,w]=q,[tx,ty,tz]=p,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,xw=x*w,yw=y*w,zw=z*w;return new Float32Array([1-2*(yy+zz),2*(xy+zw),2*(xz-yw),0,2*(xy-zw),1-2*(xx+zz),2*(yz+xw),0,2*(xz+yw),2*(yz-xw),1-2*(xx+yy),0,tx,ty,tz,1]);}
export function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[r+4*k]*b[k+4*c];o[r+4*c]=v;}return o;}
export function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const norm=a=>{const L=Math.hypot(...a)||1;return a.map(v=>v/L)};
export function lookAt(eye,tgt){const z=norm(sub(eye,tgt)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
export function translation(x=0,y=0,z=0){const a=I.slice();a[12]=x;a[13]=y;a[14]=z;return a}
export function rotateY(rad){const c=Math.cos(rad),s=Math.sin(rad);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
