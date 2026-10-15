// Assemble the Simplified Chinese trailer from the same shot lengths and original audio.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');

const [shotsArg, sourceArg, outputArg] = process.argv.slice(2);
assert(shotsArg && sourceArg && outputArg, 'Usage: node edit-zh.cjs SHOTS SOURCE OUTPUT');
const shotsPath = path.resolve(shotsArg), sourcePath = path.resolve(sourceArg), outputPath = path.resolve(outputArg);
const shots = JSON.parse(fs.readFileSync(path.join(shotsPath, 'timeline.json')));
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: 'inherit'});
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
const video = file => probe(file).streams.find(stream => stream.codec_type === 'video');
const hash = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], {encoding: 'utf8'}).trim();
assert.equal(video(sourcePath).r_frame_rate, '60/1');
assert.equal(Number(video(sourcePath).nb_frames), 1922);
for (const [name, start, end] of shots) assert.equal(Number(video(path.join(shotsPath, `${name}.mp4`)).nb_frames), end - start, `Incomplete capture: ${name}`);

// Frame 1845 is the last clean end-card frame before the English caption fades in.
const cleanPlate = path.join(shotsPath, 'ending-clean.png');
run(['-i', sourcePath, '-vf', 'select=eq(n\\,1845)', '-frames:v', '1', cleanPlate]);
const ending = path.join(shotsPath, 'ending-zh.mp4');
const caption = path.join(__dirname, 'coming-soon-zh.png');
const filter = [
  '[0:v]split[before][after]',
  '[before]trim=start_frame=1810:end_frame=1850,setpts=PTS-STARTPTS,format=yuv420p[untouched]',
  '[after]trim=start_frame=1850:end_frame=1922,setpts=PTS-STARTPTS,format=gbrp[original]',
  "[1:v]eq=brightness='0.06+min(n/8,1)*0.06':eval=frame,format=gbrp[plate]",
  'color=c=black:s=1920x1080:r=60:d=1.2,drawbox=x=480:y=925:w=960:h=125:color=white:t=fill,gblur=sigma=5,format=gbrp[mask]',
  '[original][plate][mask]maskedmerge,format=yuv420p[repaired]',
  '[2:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1[caption]',
  '[repaired][caption]overlay=0:0:shortest=1,format=yuv420p[edited]',
  '[untouched][edited]concat=n=2:v=1:a=0[v]',
].join(';');
run(['-i', sourcePath, '-loop', '1', '-framerate', '60', '-i', cleanPlate, '-loop', '1', '-framerate', '60', '-i', caption, '-filter_complex', filter, '-map', '[v]', '-frames:v', '112', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', ending]);

const edited = [];
for (let i = 0; i < shots.length; i++) {
  const [name, start, end] = shots[i], length = end - start, file = path.join(shotsPath, `${name}.mp4`);
  if (i <= 7) {
    const dest = path.join(shotsPath, `${name}-edit.mp4`);
    const z = `if(lt(in,4),${i === 0 ? '1' : '1.12-0.03*in'},if(gt(in,${length - 5}),1+(in-${length - 5})*0.03,1))`;
    const vf = `zoompan=z='${z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=60,gblur=sigma=3:enable='${i === 0 ? '0' : 'lt(n,4)'}+gt(n,${length - 5})'` + (i === 0 ? ",drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='lt(n,2)'" : '');
    run(['-i', file, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', dest]);
    edited.push(dest);
  } else edited.push(file);
}
edited.push(ending);
const concat = path.join(shotsPath, 'concat-zh.txt');
fs.writeFileSync(concat, edited.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
run(['-f', 'concat', '-safe', '0', '-i', concat, '-i', sourcePath, '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,setsar=1', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', '60', '-fps_mode', 'cfr', '-c:a', 'copy', '-movflags', '+faststart', outputPath]);
assert.equal(Number(video(outputPath).nb_frames), 1922);
assert.equal(hash(outputPath), hash(sourcePath), 'Original audio packets must stay unchanged');
run(['-i', outputPath, '-f', 'null', '-']);
fs.writeFileSync(path.join(path.dirname(outputPath), 'trailer-zh-verification.json'), JSON.stringify({source: sourcePath, output: outputPath, frames: 1922, fps: 60, width: 1920, height: 1080, audioPacketHash: hash(outputPath), duration: probe(outputPath).format.duration, shots}, null, 2));
console.log('Verified: 1922 frames, original audio unchanged, full decode passed.');
