const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const [shotsPath,originalPath,outputPath]=process.argv.slice(2).map(value=>path.resolve(value));
const shots=JSON.parse(fs.readFileSync(path.join(shotsPath,'timeline.json')));
const run=args=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]));
const source=probe(originalPath),video=source.streams.find(s=>s.codec_type==='video');
assert.equal(video.r_frame_rate,'60/1');
assert.equal(Number(video.nb_frames),1922);
for(const [name,start,end] of shots)assert.equal(Number(probe(path.join(shotsPath,name+'.mp4')).streams[0].nb_frames),end-start,'Incomplete capture: '+name);
run(['-i',originalPath,'-vf','trim=start_frame=1810,setpts=PTS-STARTPTS','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',path.join(shotsPath,'ending.mp4')]);
// Match the short zoom-blur edits without changing a shot's frame count.
const edited=[];
for(let i=0;i<shots.length;i++) {
 const [name,start,end]=shots[i],length=end-start,file=path.join(shotsPath,name+'.mp4');
 if(i<=7) {
  const dest=path.join(shotsPath,name+'-edit.mp4');
  const z=`if(lt(in,4),${i===0?'1':'1.12-0.03*in'},if(gt(in,${length-5}),1+(in-${length-5})*0.03,1))`;
  const vf=`zoompan=z='${z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=60,gblur=sigma=3:enable='${i===0?'0':'lt(n,4)'}+gt(n,${length-5})'`+(i===0?",drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='lt(n,2)'":'');
  run(['-i',file,'-vf',vf,'-an','-c:v','libx264','-preset','fast','-crf','16',dest]);edited.push(dest);
 } else edited.push(file);
}
edited.push(path.join(shotsPath,'ending.mp4'));
const concat=path.join(shotsPath,'concat.txt');fs.writeFileSync(concat,edited.map(file=>`file '${file.replaceAll("'","'\\''")}'`).join('\n'));
run(['-f','concat','-safe','0','-i',concat,'-i',originalPath,'-map','0:v:0','-map','1:a:0','-vf','scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,setsar=1','-c:v','libx264','-preset','fast','-crf','16','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-r','60','-fps_mode','cfr','-c:a','copy','-movflags','+faststart',outputPath]);
const result=probe(outputPath);assert.equal(Number(result.streams.find(s=>s.codec_type==='video').nb_frames),1922);
const hash=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-'],{encoding:'utf8'}).trim();
assert.equal(hash(outputPath),hash(originalPath),'Original audio packets must stay unchanged');
run(['-i',outputPath,'-f','null','-']);
fs.writeFileSync(path.join(path.dirname(outputPath),'trailer-verification.json'),JSON.stringify({source:originalPath,output:outputPath,frames:1922,fps:60,width:1920,height:1080,audioPacketHash:hash(outputPath),duration:result.format.duration,shots},null,2));
run(['-i',path.join(shotsPath,'opening.mp4'),'-vf',"select=eq(n\\,320)",'-frames:v','1',path.join(path.dirname(outputPath),'Emberhall-Gameplay-Multikill-1920x1080.png')]);
console.log('Verified: 1922 frames, original audio unchanged, full decode passed.');
