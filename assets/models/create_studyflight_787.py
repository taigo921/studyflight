#!/usr/bin/env python3
"""Procedurally model a stylized Boeing 787-9 inspired airliner for StudyFlight.
No third-party aircraft meshes or copyrighted textures are used.
Coordinates (m): nose +X, right wing +Y, up +Z.
"""
from pathlib import Path
import numpy as np
import trimesh
from scipy.interpolate import PchipInterpolator
from trimesh.creation import icosphere

OUT=Path('/mnt/data')
W=(244,247,249,255)
SILVER=(194,210,224,255)
ICE=(215,235,248,255)
BLUE=(38,150,226,255)
CYAN=(65,214,245,255)
NAVY=(8,39,83,255)
DEEP=(8,22,43,255)
WINDOW=(21,51,77,255)
DARK=(21,27,38,255)
FAN=(77,91,105,255)
GRAPHITE=(47,55,66,255)
ENGINE=(234,241,247,255)
RED=(242,64,82,255)
GREEN=(44,231,163,255)
scene = trimesh.Scene()
meshes=[]

def add(mesh,name,color):
    if mesh is None:return
    mesh.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8), (len(mesh.vertices),1))
    scene.add_geometry(mesh,geom_name=name)
    meshes.append((mesh,name,color))

def surf_mesh(verts, faces):
    return trimesh.Trimesh(vertices=np.asarray(verts,dtype=np.float32),faces=np.asarray(faces,dtype=np.int32),process=False)

# Interpolate cross-sectional geometry along the central axis.
xs=np.array([-31.4,-31.2,-30.7,-30,-28.5,-26,-23,-20,0,18,22,24,25.6,27.1,28.4,29.4,30.15,30.8,31.35])
rs=np.array([.09,.45,.85,1.30,1.9,2.45,2.73,2.83,2.83,2.83,2.75,2.61,2.32,1.95,1.51,1.13,.78,.38,.05])
czs=np.array([.40,.40,.38,.30,.20,.07,.03,0,0,0,.01,.02,-.03,-.12,-.19,-.25,-.25,-.2,-.12])
rad=PchipInterpolator(xs,rs)
center=PchipInterpolator(xs,czs)

def fus_surface(x,theta,extra=0.015):
    r=float(rad(x))+extra
    return [x,r*np.cos(theta),float(center(x))+r*np.sin(theta)]

segments=64
xlines=np.linspace(xs[0],xs[-1],160)
thetas=np.linspace(0,2*np.pi,segments,endpoint=False)
v=[]
for x in xlines:
    for t in thetas:v.append(fus_surface(x,t,extra=0))
f=[]
for j in range(len(xlines)-1):
    for i in range(segments):
        a=j*segments+i;b=j*segments+(i+1)%segments
        c=(j+1)*segments+i;d=(j+1)*segments+(i+1)%segments
        f.extend([[a,b,c],[b,d,c]])
for i in range(1,segments-1):f.append([0,i,i+1])
base=(len(xlines)-1)*segments
for i in range(1,segments-1):f.append([base,base+i+1,base+i])
add(surf_mesh(v,f),'787-9_white_composite_fuselage',W)

# Navy underside from low waterline. Covers lower half with interpolated surface patches.
def body_patch(name,color,x_start,x_end,theta_lo,theta_hi,steps_x=90,steps_theta=40,delta=.028):
    vv=[]
    for x in np.linspace(x_start,x_end,steps_x):
        for t in np.linspace(theta_lo,theta_hi,steps_theta):vv.append(fus_surface(x,t,delta))
    ff=[]
    for j in range(steps_x-1):
        for k in range(steps_theta-1):
            a=j*steps_theta+k;b=a+1;c=a+steps_theta;d=c+1
            ff.extend([[a,b,c],[b,d,c]])
    add(surf_mesh(vv,ff),name,color)
body_patch('deep_navy_lower_fuselage',NAVY,-27.5,23,3.45,5.95,110,36)
for sid in (1,-1):
    # subtle long cyan accent lining the underside.
    if sid==1: lo,hi=5.92,5.99
    else:lo,hi=3.38,3.45
    body_patch(f'cyan_cabin_accent_{sid}',CYAN,-26,22.8,lo,hi,85,4,.041)

# Large 787 cabin oval windows near the upper shoulders of the fuselage.
def window_surface(x,side,name):
    # On the positive side, theta=.38 rad; negative side theta=pi-.38.
    t0=.43 if side==1 else np.pi-.43
    center_pos=np.array(fus_surface(x,t0,.038))
    # surface tangents; x is fuselage direction, theta is side upward direction.
    tangent=np.array([0,-np.sin(t0),np.cos(t0)])
    dx=.23; dt=.27
    vv=[center_pos]
    for k in range(16):
        a=2*np.pi*k/16
        vv.append(center_pos+np.array([dx*np.cos(a),0,0])+dt*np.sin(a)*tangent)
    ff=[[0,k+1,(k+1)%16+1] for k in range(16)]
    return surf_mesh(vv,ff)
for side in (-1,1):
    # 58 visible oval windows per side excluding doors; some wings obscure windows from above.
    for idx,x in enumerate(np.arange(-24.2,21.7,.80)):
        add(window_surface(x,side,f'win_{side}_{idx}'),f'oval_cabin_window_{side}_{idx:02d}',WINDOW)
    # four clearly visible entry door borders; same upper side.
    for x in [-23.2,-10.3,11.1,22.1]:
        t0=.17 if side==1 else np.pi-.17
        # Make a trim border consisting of thin silver line segments on the fuselage.
        corners=[(x-.48,t0-.29),(x+.48,t0-.29),(x+.48,t0+.29),(x-.48,t0+.29)]
        # skipped to avoid distracting from windows: surface markings are enough.

# 787 curved cockpit windshield assembly on both sides.
def decal_patch(name,side,coordinates,color,delta=.060):
    vv=[]
    for x,t in coordinates:
        tv=t if side==1 else np.pi-t
        vv.append(fus_surface(x,tv,delta))
    ff=[[0,i,i+1] for i in range(1,len(vv)-1)]
    # Render both sides of cockpit window.
    ff += [[c,b,a] for a,b,c in ff]
    add(surf_mesh(vv,ff),name,color)
for side in (1,-1):
    # Four windscreen sections, strongly swept and wrap to the sides.
    # narrow glass segments show 787-style eyebrowless cockpit.
    decal_patch(f'787_forward_windscreen_outer_{side}',side,
        [(26.7,.29),(28.5,.55),(28.2,.90),(26.4,.77)],DEEP)
    decal_patch(f'787_forward_windscreen_inner_{side}',side,
        [(27.5,.94),(29.10,1.16),(28.65,1.51),(27.0,1.30)],DEEP)

# Wings are derived from spanwise airfoil sections, with upward flex and swept raked tips.
# stations = (span, x_leading, x_trailing, height center, maximum thickness)
wing_stations=[(2.35,8.2,-10.5,-.55,.86),(4.0,7.3,-10.9,-.56,.84),
 (7.0,5.95,-11.9,-.43,.72),(10,4.10,-12.45,-.20,.61),
 (13.6,1.65,-12.85,.15,.48),(17.0,-.85,-13.1,.53,.37),
 (21.2,-4.1,-13.35,1.17,.29),(24.3,-6.6,-13.65,1.98,.23),
 (27.0,-9.0,-13.85,2.85,.15),(28.7,-10.7,-13.96,3.66,.10),
 (30.05,-13.08,-14.0,4.65,.045)]

def build_wing(side,start=0,stop=None):
    # cross section from LE to TE has smoothly bulged airfoil profiles.
    stops=wing_stations[start:stop]
    N=17;vv=[]
    uvals=np.linspace(0,1,N)
    for y,x_le,x_te,zz,th in stops:
        for face_sign in (1,-1):
            for u in uvals:
                shape=np.power(max(np.sin(np.pi*u),0.0),.75)
                z=zz + face_sign*th*.5*shape + .08*(1-u)
                vv.append([x_le*(1-u)+x_te*u,side*y,z])
    ff=[];step=2*N
    for j in range(len(stops)-1):
        for i in range(N-1):
            for face_ind in (0,1):
                a=j*step+face_ind*N+i;b=a+1;c=a+step;d=c+1
                if (side == 1 and face_ind == 0) or (side == -1 and face_ind == 1):
                    ff.extend([[a,c,b],[b,c,d]])
                else:
                    ff.extend([[a,b,c],[b,d,c]])
        # Leading and trailing edges linking top/bottom.
        for k in [0,N-1]:
            a=j*step+k;b=j*step+N+k;c=a+step;d=b+step
            ff.extend([[a,b,c],[b,d,c]])
    # Root and tip cap.
    for j in [0,len(stops)-1]:
        offset=j*step
        for i in range(N-1):
            a=offset+i;b=a+1;c=offset+N+i;d=c+1
            ff.extend([[a,b,c],[b,d,c]])
    return surf_mesh(vv,ff)

for side in (-1,1):
    add(build_wing(side),f'787_flexed_swept_main_wing_{side}',W)
    # Very distinctive slim dark blue rake at the tip (no vertical winglet).
    add(build_wing(side,start=9),f'raked_wingtip_navy_{side}',NAVY)
    add(build_wing(side,start=10),f'wingtip_cap_{side}',BLUE)

    # Thin up-facing flap/aileron lines, blue-gray highlight on trailing edge.
    stations=np.array(wing_stations)
    for idx in [(2,5),(5,8)]:
        st0=wing_stations[idx[0]]; st1=wing_stations[idx[1]]
        vs=[]
        for st in [st0,st1]:
            y,le,te,z,th=st
            x=te+.58
            vs.extend([[x,side*y,z+.030],[x+.08,side*y,z+.031]])
        add(surf_mesh(vs,[[0,1,2],[1,3,2],[2,1,0],[2,3,1]]),f'flap_divider_{side}_{idx[0]}',SILVER)

    # Underslung GEnx-style large turbofan. Fan points forward (+X).
    ey=side*10.6;ez=-3.35
    front=9.5
    profile=[(3.12,1.02),(3.32,1.20),(3.64,1.43),(4.4,1.57),
             (5.85,1.70),(7.25,1.76),(8.75,1.75),(9.15,1.72),(9.45,1.63)]
    def lathe_engine(profile, name,color,N=40):
        vv=[]
        for x,r in profile:
            for k in range(N):
                t=2*np.pi*k/N
                vv.append([x,ey+r*np.cos(t),ez+r*np.sin(t)])
        ff=[]
        for i in range(len(profile)-1):
            for k in range(N):
                a=i*N+k;b=i*N+(k+1)%N;c=(i+1)*N+k;d=(i+1)*N+(k+1)%N
                ff.extend([[a,b,c],[b,d,c]])
        add(surf_mesh(vv,ff),name,color)
    lathe_engine(profile,f'787_large_engine_nacelle_{side}',ENGINE)
    lathe_engine([(9.18,1.73),(9.51,1.64),(9.50,1.46),(9.18,1.43)],f'787_polished_intake_lip_{side}',SILVER)
    # Disk, fan swirl and spinner visible in frontal intake.
    def disk_at(x,r,color,name,ns=32):
        vv=[[x,ey,ez]]
        for k in range(ns):
            t=2*np.pi*k/ns;vv.append([x,ey+r*np.cos(t),ez+r*np.sin(t)])
        ff=[[0,1+k,1+((k+1)%ns)] for k in range(ns)]
        add(surf_mesh(vv,ff),name,color)
    disk_at(9.19,1.45,DARK,f'787_intake_black_{side}')
    for k in range(20):
        a=2*np.pi*k/20
        # pitched tapered, curved blades
        vv=[]
        for rr,da,xx in [(.22,0,9.27),(1.38,.20,9.30),(1.38,.43,9.31),(.22,.23,9.27)]:
            t=a+da
            vv.append([xx,ey+rr*np.cos(t),ez+rr*np.sin(t)])
        add(surf_mesh(vv,[[0,1,2],[0,2,3],[2,1,0],[3,2,0]]),f'787_visible_fan_blade_{side}_{k}',FAN)
    # Rounded spinner, flattened along longitudinal direction
    spinner=icosphere(subdivisions=2,radius=1.)
    spinner.apply_scale([.60,.25,.25]);spinner.apply_translation([9.27,ey,ez])
    add(spinner,f'787_spinner_{side}',SILVER)
    # 787 serrated chevrons around bypass duct lip at rear of nacelle.
    N=24;vv=[]
    for i in range(2*N):
        t=2*np.pi*i/(2*N)
        x=3.25 if i%2 else 3.72
        rr=1.18+(0.01 if i%2==0 else 0)
        vv.append([x,ey+rr*np.cos(t),ez+rr*np.sin(t)])
    ff=[[i,(i+1)%(2*N),(i+2)%(2*N)] for i in range(0,2*N,2)]
    add(surf_mesh(vv,ff),f'787_serrated_engine_chevrons_{side}',SILVER)
    # Internal exhaust dark cone.
    lathe_engine([(2.95,.50),(3.42,.72),(3.78,.68)],f'787_exhaust_inner_{side}',GRAPHITE)

    # Engine pylon to the wing. Curved trapezoid solid in Y.
    pyl=[(3.6,-1.0),(5.75,-1.0),(7.2,-1.95),(6.7,-2.45),(4.5,-2.2)]
    vv=[]
    for yo in [-.24,.24]:
        for x,z in pyl:vv.append([x,ey+yo,z])
    ff=[];n=len(pyl)
    for i in range(1,n-1):
        ff.extend([[0,i,i+1],[n,n+i+1,n+i]])
    for i in range(n):
        j=(i+1)%n;ff.extend([[i,j,n+j],[i,n+j,n+i]])
    add(surf_mesh(vv,ff),f'787_engine_pylon_{side}',SILVER)

    # Horizontal tailplanes, designed without winglets.
    tailstations=[(1.2,-20.4,-30.6,1.55,.33),(3.0,-22.0,-30.2,1.60,.31),
                  (6.0,-24.3,-30.15,1.86,.20),(9.4,-27.1,-30.0,2.45,.12),
                  (10.7,-28.6,-29.8,2.71,.05)]
    N=9;vv=[]
    for y,le,te,z,th in tailstations:
        for fac in [1,-1]:
            for u in np.linspace(0,1,N):
                vv.append([le*(1-u)+te*u,side*y,z+fac*.5*th*np.sin(np.pi*u)])
    ff=[]
    for j in range(len(tailstations)-1):
        for k in range(N-1):
            for face_ind in [0,1]:
                a=j*N*2+face_ind*N+k;b=a+1;c=a+2*N;d=c+1
                if (side == 1 and face_ind == 0) or (side == -1 and face_ind == 1):
                    ff.extend([[a,c,b],[b,c,d]])
                else:
                    ff.extend([[a,b,c],[b,d,c]])
    add(surf_mesh(vv,ff),f'787_horizontal_tailplane_{side}',W)

# Large curved swept tail fin, flight level approx 17m overall including ground gear.
outline=[(-19.5,1.82),(-21.7,4.3),(-25.6,10.55),(-27.7,11.3),(-28.5,11.21),(-30.9,2.0)]
vs=[]
for y in [-.20,.20]:
    for x,z in outline:vs.append([x,y,z])
n=len(outline);ff=[]
for k in range(1,n-1):ff.extend([[0,k,k+1],[n,n+k+1,n+k]])
for k in range(n):
    j=(k+1)%n;ff.extend([[k,j,n+j],[k,n+j,n+k]])
add(surf_mesh(vs,ff),'787_swept_vertical_tail',NAVY)
for sid in (-1,1):
    yy=sid*.224
    vs=[[-21.9,yy,2.92],[-23.5,yy,4.18],[-27.15,yy,10.65],[-27.95,yy,10.48],[-25.3,yy,5.60]]
    ff=[[0,1,4],[1,2,3],[1,3,4]]
    add(surf_mesh(vs,ff),f'StudyFlight_light_blue_tail_emblem_{sid}',BLUE)
    # White stylized angle within the blue fin emblem.
    vs=[[-25.18,sid*.243,6.28],[-26.18,sid*.243,7.75],[-27.25,sid*.243,8.72],[-26.50,sid*.243,8.75]]
    add(surf_mesh(vs,[[0,1,2],[0,2,3],[3,2,1],[3,1,0]]),f'StudyFlight_tail_arrow_{sid}',ICE)

# Navigation lights
for sid in (1,-1):
    light=icosphere(subdivisions=1,radius=.14)
    light.apply_translation([-13.9,sid*30.02,4.66])
    add(light,f'wingtip_navigation_light_{sid}',GREEN if sid==1 else RED)

model_path=OUT/'StudyFlight_Boeing_787-9.glb'
model_path.write_bytes(scene.export(file_type='glb'))
print('SAVED',model_path,'bytes',model_path.stat().st_size,'GEOMETRIES',len(scene.geometry))
print('BOUNDS',scene.bounds)

# separate model metadata for implementation
(OUT/'StudyFlight_Boeing_787-9_README.txt').write_text('''StudyFlight aircraft model — Boeing 787-9 inspired (original procedural geometry)\n\nFile: StudyFlight_Boeing_787-9.glb\nCoordinates: +X nose / +/-Y wings / +Z up. Units: meters.\nApproximate dimensions: 62.8 m fuselage length / 60.1 m wingspan.\nIncludes curved raked wingtip, flexed wings, two engine nacelles with serrated chevron edges, cockpit/cabin windows, navy and cyan StudyFlight-style livery.\n\nExample (Three.js):\nconst loader = new GLTFLoader();\nloader.load('/models/StudyFlight_Boeing_787-9.glb', (gltf) => {\n  const plane = gltf.scene;\n  plane.scale.setScalar(1);\n  scene.add(plane);\n});\n\nNote: This model is a hand-built stylized approximation of the Boeing 787-9, NOT a licensed Boeing CAD model or an engineering-accurate replica. Do not use as a flight simulation engineering model.\n''', encoding='utf-8')

# render production preview, geometries downsampled to stay fast.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from matplotlib import colors

fig=plt.figure(figsize=(15,9),facecolor='#0a1629')
views=[(1,2,1, (36,-59),'3/4 VIEW'),(2,2,2,(84,-90),'TOP VIEW'),(2,2,4,(10,155),'SIDE PROFILE')]
# Build a big 3/4 view and two side panels with careful layout.
from matplotlib.gridspec import GridSpec
gs=GridSpec(2,2,figure=fig,width_ratios=[1.24,1],height_ratios=[1,1],wspace=.035,hspace=.055,left=.015,right=.985,bottom=.07,top=.94)
positions=[(gs[:,0],25,-55,'787-9  |  STUDYFLIGHT'),(gs[0,1],78,-90,'TOP  /  60.1 m wingspan'),(gs[1,1],9,-90,'SIDE  /  62.8 m length')]

def draw(ax,elev,azim,title):
    ax.set_facecolor('#0c1c33')
    for mesh,name,col in meshes:
        tri=mesh.vertices[mesh.faces]
        color=np.asarray(col,dtype=float)[:3]/255
        light=np.array([.28,-.38,.89],dtype=float)
        light/=np.linalg.norm(light)
        normals=mesh.face_normals
        cosine=np.clip(normals@light,0,1)
        # Ambient + directional lighting highlights curved body and swept wing surfaces.
        illum=(.57+.43*cosine)[:,None]
        shaded=np.clip(color[None,:]*illum,0,1)
        p=Poly3DCollection(tri,facecolors=shaded,edgecolors='none',linewidths=0,alpha=1)
        ax.add_collection3d(p)
    ax.set_xlim(-34,34); ax.set_ylim(-32,32);ax.set_zlim(-7,14)
    ax.set_box_aspect((68,64,30),zoom=1.20)
    ax.view_init(elev=elev,azim=azim)
    ax.set_axis_off()
    ax.text2D(.045,.93,title,transform=ax.transAxes,color='#eef8ff',fontsize=13,fontweight='bold',family='DejaVu Sans')
for pos,el,az,title in positions:
    ax=fig.add_subplot(pos,projection='3d',computed_zorder=True)
    draw(ax,el,az,title)
fig.text(.035,.033,'B787-9 DREAMLINER  •  custom lightweight 3D model  •  GLB',fontsize=12,color='#83b9df',family='DejaVu Sans')
preview_path=OUT/'StudyFlight_Boeing_787-9_preview.png'
fig.savefig(preview_path,dpi=145,facecolor=fig.get_facecolor(),bbox_inches='tight',pad_inches=.03)
plt.close(fig)
print('PREVIEW',preview_path,'bytes',preview_path.stat().st_size)
